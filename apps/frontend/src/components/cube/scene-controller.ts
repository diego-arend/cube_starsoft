import * as THREE from "three";
import { CameraController } from "./camera-controller";
import { RepresentationManager } from "./representation-manager";
import { FaceSelectionManager } from "./face-selection-manager";
import { ChunkManager, TILE_WORLD_SIZE, SQUARE_STEP, SQUARE_SIZE, CUBE_DEPTH, type RemovedSquare } from "./chunk-manager";
import { TILES_PER_SIDE, TILE_SIZE, type FaceId } from "./cube-data-model";

const FACE_NORMALS_LOOKUP: Array<{ normal: THREE.Vector3; id: FaceId }> = [
  { normal: new THREE.Vector3(1, 0, 0), id: "+X" },
  { normal: new THREE.Vector3(-1, 0, 0), id: "-X" },
  { normal: new THREE.Vector3(0, 1, 0), id: "+Y" },
  { normal: new THREE.Vector3(0, -1, 0), id: "-Y" },
  { normal: new THREE.Vector3(0, 0, 1), id: "+Z" },
  { normal: new THREE.Vector3(0, 0, -1), id: "-Z" },
];

const FACE_NORMAL_VEC: Record<FaceId, THREE.Vector3> = {
  "+X": new THREE.Vector3(1, 0, 0),
  "-X": new THREE.Vector3(-1, 0, 0),
  "+Y": new THREE.Vector3(0, 1, 0),
  "-Y": new THREE.Vector3(0, -1, 0),
  "+Z": new THREE.Vector3(0, 0, 1),
  "-Z": new THREE.Vector3(0, 0, -1),
};

export interface SceneStats {
  mode: string;
  activeFace: string;
  fps: number;
  hint: string;
}

export class SceneController {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;

  private readonly solidGroup: THREE.Group;
  private readonly faceGroup: THREE.Group;
  private readonly chunkGroup: THREE.Group;
  private cubeMesh!: THREE.Mesh;

  readonly cameraController: CameraController;
  private readonly representationManager: RepresentationManager;
  private readonly faceSelectionManager: FaceSelectionManager;
  private readonly chunkManager: ChunkManager;

  private readonly raycaster = new THREE.Raycaster();
  private animationId: number | null = null;
  private lastTime = 0;
  private fps = 0;
  private statsCallback: ((stats: SceneStats) => void) | null = null;
  private statsFrame = 0;

  private _activeFace: FaceId = "+Z";
  private _hint = "Duplo clique em uma face para inspecioná-la";

  private readonly canvas: HTMLCanvasElement;
  private readonly _boundDblClick: (e: MouseEvent) => void;
  private readonly _boundClick: (e: MouseEvent) => void;
  private readonly _boundPointerMove: (e: PointerEvent) => void;
  /** Group holding transient square-highlight meshes */
  private readonly highlightGroup: THREE.Group;
  private _hoverHighlight: THREE.Mesh | null = null;
  private _hoveredSquareKey: string | null = null;
  /** Group holding dark-spot quads painted on the solid cube when chunks are removed */
  private readonly darkSpotsGroup: THREE.Group;
  private _spotGeo: THREE.PlaneGeometry | null = null;
  private _spotMat: THREE.MeshBasicMaterial | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f111a);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 8);
    this.scene.add(ambient, dirLight);

    this.solidGroup = new THREE.Group();
    this.faceGroup = new THREE.Group();
    this.chunkGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.scene.add(
      this.solidGroup,
      this.faceGroup,
      this.chunkGroup,
      this.highlightGroup
    );

    this.darkSpotsGroup = new THREE.Group();
    this.solidGroup.add(this.darkSpotsGroup);
    this._buildSolidCube();
    this._buildFacePlanes();

    this.cameraController = new CameraController(
      canvas,
      canvas.clientWidth,
      canvas.clientHeight
    );

    this.representationManager = new RepresentationManager(
      this.solidGroup,
      this.faceGroup,
      this.chunkGroup
    );
    this.representationManager.forceMode("solid");

    this.faceSelectionManager = new FaceSelectionManager();
    this.chunkManager = new ChunkManager(this.chunkGroup);

    this.cameraController.onBackToCubeRequested = () => this._returnToCube();

    this._boundDblClick = this._onDblClick.bind(this);
    this._boundClick = this._onClick.bind(this);
    this._boundPointerMove = this._onPointerMove.bind(this);
    canvas.addEventListener("dblclick", this._boundDblClick);
    canvas.addEventListener("click", this._boundClick);
    canvas.addEventListener("pointermove", this._boundPointerMove);
  }

  private _buildSolidCube(): void {
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshPhongMaterial({ color: 0xa0aab8, shininess: 30 });
    this.cubeMesh = new THREE.Mesh(geo, mat);

    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xccd5df });
    const wireframe = new THREE.LineSegments(edges, lineMat);

    this.solidGroup.add(this.cubeMesh, wireframe);
    this._buildSolidGridOverlay();
  }

  /**
   * Draws tile-boundary grid lines on all 6 faces of the solid cube.
   * Each face is divided into TILES_PER_SIDE × TILES_PER_SIDE cells,
   * visible in the overview (cube mode) to show the chunk structure.
   */
  private _buildSolidGridOverlay(): void {
    const faceConfigs: Array<{
      position: THREE.Vector3;
      rotation: THREE.Euler;
    }> = [
      {
        position: new THREE.Vector3(1.002, 0, 0),
        rotation: new THREE.Euler(0, Math.PI / 2, 0),
      },
      {
        position: new THREE.Vector3(-1.002, 0, 0),
        rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      },
      {
        position: new THREE.Vector3(0, 1.002, 0),
        rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      },
      {
        position: new THREE.Vector3(0, -1.002, 0),
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      },
      {
        position: new THREE.Vector3(0, 0, 1.002),
        rotation: new THREE.Euler(0, 0, 0),
      },
      {
        position: new THREE.Vector3(0, 0, -1.002),
        rotation: new THREE.Euler(0, Math.PI, 0),
      },
    ];

    const half = 1;
    const step = (half * 2) / TILES_PER_SIDE;
    const positions: number[] = [];

    // Horizontal lines
    for (let i = 0; i <= TILES_PER_SIDE; i++) {
      const v = -half + i * step;
      positions.push(-half, v, 0, half, v, 0);
    }
    // Vertical lines
    for (let i = 0; i <= TILES_PER_SIDE; i++) {
      const u = -half + i * step;
      positions.push(u, -half, 0, u, half, 0);
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    const gridMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      opacity: 0.15,
      transparent: true,
    });

    for (const cfg of faceConfigs) {
      const lines = new THREE.LineSegments(gridGeo, gridMat);
      lines.position.copy(cfg.position);
      lines.rotation.copy(cfg.rotation);
      this.solidGroup.add(lines);
    }
  }

  private _buildFacePlanes(): void {
    const faceConfigs: Array<{
      position: THREE.Vector3;
      rotation: THREE.Euler;
      color: number;
      normalDir: THREE.Vector3;
    }> = [
      {
        position: new THREE.Vector3(1.001, 0, 0),
        rotation: new THREE.Euler(0, Math.PI / 2, 0),
        color: 0x6e7a8a,
        normalDir: new THREE.Vector3(1, 0, 0),
      },
      {
        position: new THREE.Vector3(-1.001, 0, 0),
        rotation: new THREE.Euler(0, -Math.PI / 2, 0),
        color: 0x6e7a8a,
        normalDir: new THREE.Vector3(-1, 0, 0),
      },
      {
        position: new THREE.Vector3(0, 1.001, 0),
        rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
        color: 0x6e7a8a,
        normalDir: new THREE.Vector3(0, 1, 0),
      },
      {
        position: new THREE.Vector3(0, -1.001, 0),
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
        color: 0x6e7a8a,
        normalDir: new THREE.Vector3(0, -1, 0),
      },
      {
        position: new THREE.Vector3(0, 0, 1.001),
        rotation: new THREE.Euler(0, 0, 0),
        color: 0x6e7a8a,
        normalDir: new THREE.Vector3(0, 0, 1),
      },
      {
        position: new THREE.Vector3(0, 0, -1.001),
        rotation: new THREE.Euler(0, Math.PI, 0),
        color: 0x6e7a8a,
        normalDir: new THREE.Vector3(0, 0, -1),
      },
    ];

    for (const cfg of faceConfigs) {
      const planeGeo = new THREE.PlaneGeometry(2, 2);
      const planeMat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        side: THREE.FrontSide,
      });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.position.copy(cfg.position);
      plane.rotation.copy(cfg.rotation);
      this.faceGroup.add(plane);
    }
  }

  private _onClick(e: MouseEvent): void {
    if (
      this.cameraController.mode !== "face" ||
      this.cameraController.isAnimating
    )
      return;
    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.cameraController.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.cameraController.camera);

    const instancedMeshes: THREE.InstancedMesh[] = [];
    this.chunkGroup.traverse((obj) => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh && !obj.userData.isHover) {
        instancedMeshes.push(obj as THREE.InstancedMesh);
      }
    });

    const hits = this.raycaster.intersectObjects(instancedMeshes, false);
    if (hits.length > 0 && hits[0]!.instanceId !== undefined) {
      const hit = hits[0]!;
      const instanceId = hit.instanceId!;
      const col = instanceId % TILE_SIZE;
      const row = Math.floor(instanceId / TILE_SIZE);
      const tileGroup = hit.object.parent as THREE.Group;
      this.chunkManager.hideSquare(tileGroup.name, col, row);
      // Clear hover so it doesn't linger over the removed cube
      this._clearHoverHighlight();
    }

    this.onSquareClick?.(e.clientX, e.clientY);
  }

  private _clearHoverHighlight(): void {
    if (!this._hoverHighlight) return;
    this._hoverHighlight.parent?.remove(this._hoverHighlight);
    this._hoverHighlight.geometry.dispose();
    (this._hoverHighlight.material as THREE.Material).dispose();
    this._hoverHighlight = null;
    this._hoveredSquareKey = null;
  }

  private _onPointerMove(e: PointerEvent): void {
    if (
      this.cameraController.mode !== "face" ||
      this.cameraController.isAnimating
    )
      return;

    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Force camera matrixWorld before raycasting to prevent frame-stale ray origins.
    this.cameraController.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.cameraController.camera);

    const instancedMeshes: THREE.InstancedMesh[] = [];
    this.chunkGroup.traverse((obj) => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh && !obj.userData.isHover) {
        instancedMeshes.push(obj as THREE.InstancedMesh);
      }
    });

    const hits = this.raycaster.intersectObjects(instancedMeshes, false);
    if (!hits.length || hits[0]!.instanceId === undefined) {
      this._clearHoverHighlight();
      return;
    }

    const hit = hits[0]!;
    const instanceId = hit.instanceId!;
    const col = instanceId % TILE_SIZE;
    const row = Math.floor(instanceId / TILE_SIZE);
    const tileGroup = hit.object.parent as THREE.Group;
    const squareKey = `${tileGroup.name}:${col}:${row}`;
    if (squareKey === this._hoveredSquareKey) return;

    this._clearHoverHighlight();
    this._hoveredSquareKey = squareKey;

    // Get instance local position from matrix for pixel-perfect hover placement
    const instMatrix = new THREE.Matrix4();
    (hit.object as THREE.InstancedMesh).getMatrixAt(instanceId, instMatrix);
    const instPos = new THREE.Vector3().setFromMatrixPosition(instMatrix);

    const hoverSize = SQUARE_SIZE * 0.96;
    const hoverGeo = new THREE.PlaneGeometry(hoverSize, hoverSize);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0x00cfff,
      transparent: true,
      opacity: 0.75,
      depthTest: false,
    });
    const hoverMesh = new THREE.Mesh(hoverGeo, hoverMat);
    // Position on top face of the mini-cube: z = cube center + half depth
    hoverMesh.position.set(instPos.x, instPos.y, instPos.z + CUBE_DEPTH / 2 + 0.001);
    hoverMesh.userData.isHover = true;
    tileGroup.add(hoverMesh);
    this._hoverHighlight = hoverMesh;
  }

  private _suppressNextClick = false;

  private _updateDarkSpots(): void {
    // Clear existing spots
    while (this.darkSpotsGroup.children.length > 0) {
      this.darkSpotsGroup.remove(this.darkSpotsGroup.children[0]!);
    }
    this._spotGeo?.dispose();
    this._spotMat?.dispose();
    this._spotGeo = null;
    this._spotMat = null;

    const removed = this.chunkManager.getRemovedSquares(this._activeFace);
    if (!removed.length) return;

    // Force chunk group matrices in sync (chunkGroup is hidden but still in scene graph)
    this.chunkGroup.updateWorldMatrix(true, true);

    this._spotGeo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.8, SQUARE_SIZE * 0.8);
    this._spotMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.82,
      polygonOffset: true,
      polygonOffsetFactor: 3,
      polygonOffsetUnits: 3,
    });

    const _tmpQuat = new THREE.Quaternion();
    for (const sq of removed) {
      const entry = this.chunkManager.getTileGroup(sq.tileKey);
      if (!entry) continue;
      const half = TILE_WORLD_SIZE / 2;
      const localPos = new THREE.Vector3(
        -half + (sq.col + 0.5) * SQUARE_STEP,
        -half + (sq.row + 0.5) * SQUARE_STEP,
        0.004
      );
      const worldPos = entry.group.localToWorld(localPos);
      const mesh = new THREE.Mesh(this._spotGeo, this._spotMat);
      mesh.position.copy(worldPos);
      entry.group.getWorldQuaternion(_tmpQuat);
      mesh.quaternion.copy(_tmpQuat);
      this.darkSpotsGroup.add(mesh);
    }
  }

  private _onDblClick(e: MouseEvent): void {
    this._suppressNextClick = true;
    if (
      this.cameraController.mode !== "cube" ||
      this.cameraController.isAnimating
    )
      return;

    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(
      new THREE.Vector2(x, y),
      this.cameraController.camera
    );
    const hits = this.raycaster.intersectObject(this.cubeMesh, false);
    const hit = hits[0];
    if (!hit || !hit.face) return;

    const localNormal = hit.face.normal.clone();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(
      this.cubeMesh.matrixWorld
    );
    localNormal.applyMatrix3(normalMatrix).normalize();

    const face = this._snapNormalToFace(localNormal);
    this._activeFace = face;
    this._hint = `Voando para face ${face}…`;

    // Pre-build all chunks for this face before the animation finishes
    this.chunkManager.updateFace(face);

    this.cameraController.animateToFace(FACE_NORMAL_VEC[face], () => {
      // Show face and ALL its chunks as soon as camera lands
      this.representationManager.forceMode("face");
      this._hint = "Zoom in para detalhar · Zoom out para voltar ao cubo";
    });
  }

  private _snapNormalToFace(normal: THREE.Vector3): FaceId {
    let best: FaceId = "+Z";
    let bestDot = -Infinity;
    for (const { normal: n, id } of FACE_NORMALS_LOOKUP) {
      const dot = normal.dot(n);
      if (dot > bestDot) {
        bestDot = dot;
        best = id;
      }
    }
    return best;
  }

  private _returnToCube(): void {
    this._updateDarkSpots();
    this.representationManager.forceMode("solid");
    this._hint = "Voltando ao cubo…";

    this.cameraController.animateToCube(() => {
      this._activeFace = "+Z";
      this._hint = "Duplo clique em uma face para inspecioná-la";
    });
  }

  /** Called when user clicks a square in face mode with canvas screen coords */
  onSquareClick?: (screenX: number, screenY: number) => void;

  onStats(cb: (stats: SceneStats) => void): void {
    this.statsCallback = cb;
  }

  startLoop(): void {
    let firstFrame = true;

    const animate = (time: number) => {
      this.animationId = requestAnimationFrame(animate);

      if (firstFrame) {
        this.lastTime = time;
        firstFrame = false;
        return;
      }

      const delta = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;
      if (delta > 0) this.fps = Math.round(1 / delta);

      this.cameraController.update(delta);
      this.chunkManager.update(delta);

      this.statsFrame++;
      if (this.statsFrame % 20 === 0 && this.statsCallback) {
        this.statsCallback({
          mode: this.representationManager.mode,
          activeFace: this._activeFace,
          fps: this.fps,
          hint: this._hint,
        });
      }

      this.renderer.render(this.scene, this.cameraController.camera);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.cameraController.resize(width, height);
  }

  dispose(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.canvas.removeEventListener("dblclick", this._boundDblClick);
    this.canvas.removeEventListener("click", this._boundClick);
    this.canvas.removeEventListener("pointermove", this._boundPointerMove);
    this._spotGeo?.dispose();
    this._spotMat?.dispose();
    this.chunkManager.dispose();
    this.cameraController.dispose();
    this.renderer.dispose();
  }
}
