import * as THREE from "three";
import { CameraController, type CameraMode } from "./camera-controller";
import { RepresentationManager } from "./representation-manager";
import { ChunkManager, type ChunkManager as ChunkManagerType } from "./chunk-manager";
import { MINI_CUBE_SIZE } from "./cube-data-model";

// Grid overlay divisions on the solid cube surface (decorative hierarchy hint)
const OVERLAY_DIVISIONS = 8;

export interface SceneStats {
  mode: string;
  nearChunks: number;
  fps: number;
  hint: string;
}

export class SceneController {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;

  private readonly solidGroup: THREE.Group;
  private cubeMesh!: THREE.Mesh;

  readonly cameraController: CameraController;
  private readonly representationManager: RepresentationManager;
  private readonly chunkManager: ChunkManager;

  private readonly raycaster = new THREE.Raycaster();
  private animationId: number | null = null;
  private lastTime = 0;
  private fps = 0;
  private statsCallback: ((stats: SceneStats) => void) | null = null;
  private statsFrame = 0;

  private _hint = "Aproxime o zoom para navegar no grid de chunks";
  private _nearChunks = 0;

  private readonly canvas: HTMLCanvasElement;
  private readonly _boundClick: (e: MouseEvent) => void;
  private readonly _boundDblClick: (e: MouseEvent) => void;
  private readonly _boundPointerMove: (e: PointerEvent) => void;

  /** Group holding transient hover-highlight meshes */
  private readonly highlightGroup: THREE.Group;
  private _hoverHighlight: THREE.Mesh | null = null;
  private _hoveredKey: string | null = null;

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
    this.highlightGroup = new THREE.Group();
    this._buildSolidCube();

    this.chunkManager = new ChunkManager();

    this.scene.add(
      this.solidGroup,
      this.chunkManager.lowGroup,
      this.chunkManager.highGroup,
      this.highlightGroup,
    );

    this.representationManager = new RepresentationManager(
      this.solidGroup,
      this.chunkManager.lowGroup,
      this.chunkManager.highGroup,
    );
    this.representationManager.forceMode("macro");

    this.cameraController = new CameraController(
      canvas,
      canvas.clientWidth,
      canvas.clientHeight,
    );

    this.cameraController.onLodChanged = (mode) => this._onLodChanged(mode);

    this._boundClick = this._onClick.bind(this);
    this._boundDblClick = this._onDblClick.bind(this);
    this._boundPointerMove = this._onPointerMove.bind(this);

    canvas.addEventListener("click", this._boundClick);
    canvas.addEventListener("dblclick", this._boundDblClick);
    canvas.addEventListener("pointermove", this._boundPointerMove);
  }

  // ─── Scene construction ───────────────────────────────────────────────────

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

  private _buildSolidGridOverlay(): void {
    const faceConfigs: Array<{ position: THREE.Vector3; rotation: THREE.Euler }> = [
      { position: new THREE.Vector3(1.002, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0) },
      { position: new THREE.Vector3(-1.002, 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0) },
      { position: new THREE.Vector3(0, 1.002, 0), rotation: new THREE.Euler(-Math.PI / 2, 0, 0) },
      { position: new THREE.Vector3(0, -1.002, 0), rotation: new THREE.Euler(Math.PI / 2, 0, 0) },
      { position: new THREE.Vector3(0, 0, 1.002), rotation: new THREE.Euler(0, 0, 0) },
      { position: new THREE.Vector3(0, 0, -1.002), rotation: new THREE.Euler(0, Math.PI, 0) },
    ];

    const half = 1;
    const step = (half * 2) / OVERLAY_DIVISIONS;
    const positions: number[] = [];

    for (let i = 0; i <= OVERLAY_DIVISIONS; i++) {
      const v = -half + i * step;
      positions.push(-half, v, 0, half, v, 0);
    }
    for (let i = 0; i <= OVERLAY_DIVISIONS; i++) {
      const u = -half + i * step;
      positions.push(u, -half, 0, u, half, 0);
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
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

  // ─── LOD handler ──────────────────────────────────────────────────────────

  private _onLodChanged(mode: CameraMode): void {
    this.representationManager.forceMode(mode);
    this._clearHoverHighlight();

    switch (mode) {
      case "macro":
        this._hint = "Dê um duplo clique para inspecionar";
        this.cameraController.lockZoomToMacro();
        this._nearChunks = 0;
        break;
      case "nav":
        this._hint = "Continue aproximando para detalhar";
        this._nearChunks = 0;
        break;
      case "micro":
        this._hint = "Clique em um mini-cubo para removê-lo";
        break;
    }
  }

  // ─── Click / Hover ────────────────────────────────────────────────────────

  private _onDblClick(e: MouseEvent): void {
    if (this.cameraController.mode !== "macro" || this.cameraController.isAnimating) return;

    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.cameraController.camera);
    const hits = this.raycaster.intersectObject(this.cubeMesh, false);

    const hit = hits[0];
    if (hit) {
      const hitPos = hit.point;
      const normal = hit.face?.normal.clone() || new THREE.Vector3(0, 0, 1);
      
      // Update camera target to the hit point to allow OrbitControls to center on it
      this.cameraController.controls.target.copy(hitPos);
      
      // We want to be looking directly at the face: 
      // camera position should be hitPos + normal * dist
      const VIEW_DIST = 1.15; 
      const targetPos = hitPos.clone().add(normal.multiplyScalar(VIEW_DIST));
      
      this.cameraController.unlockZoom();
      this.cameraController.animateTo(targetPos, undefined, true);
    }
  }

  private _onClick(e: MouseEvent): void {
    if (this.cameraController.mode !== "micro") return;
    
    // Only allow click interaction if the camera is near the maximum possible zoom (min distance).
    // Using a 0.2 buffer above the min distance (0.15) to ensure it's easy to reach the clickable state.
    const distFromTarget = this.cameraController.camera.position.distanceTo(this.cameraController.controls.target);
    if (distFromTarget > 0.35) return;

    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.cameraController.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(
      new THREE.Vector2(ndcX, ndcY),
      this.cameraController.camera,
    );

    const highMeshes = this.chunkManager.getHighMeshes().filter(
      (m) => !m.userData.isHover,
    );
    const hits = this.raycaster.intersectObjects(highMeshes, false);
    if (hits.length > 0 && hits[0]!.instanceId !== undefined) {
      const hit = hits[0]!;
      const cKey = (hit.object as THREE.InstancedMesh).userData.chunkKey as string;
      const cubeIdx = hit.instanceId!;
      this.chunkManager.hideCube(cKey, cubeIdx);
      this._clearHoverHighlight();
      // Only fire the click callback when a real mini-cube was hit.
      this.onSquareClick?.(e.clientX, e.clientY);
    }
  }

  private _onPointerMove(e: PointerEvent): void {
    if (this.cameraController.mode !== "micro") {
      this._clearHoverHighlight();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.cameraController.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(
      new THREE.Vector2(ndcX, ndcY),
      this.cameraController.camera,
    );

    const highMeshes = this.chunkManager.getHighMeshes().filter(
      (m) => !m.userData.isHover,
    );
    const hits = this.raycaster.intersectObjects(highMeshes, false);

    if (!hits.length || hits[0]!.instanceId === undefined) {
      this._clearHoverHighlight();
      return;
    }

    const hit = hits[0]!;
    const instanceId = hit.instanceId!;
    const cKey = (hit.object as THREE.InstancedMesh).userData.chunkKey as string;
    const squareKey = `${cKey}:${instanceId}`;
    if (squareKey === this._hoveredKey) return;

    this._clearHoverHighlight();
    this._hoveredKey = squareKey;

    // Compute world-space position of the hovered mini-cube
    const instMatrix = new THREE.Matrix4();
    (hit.object as THREE.InstancedMesh).getMatrixAt(instanceId, instMatrix);
    const localPos = new THREE.Vector3().setFromMatrixPosition(instMatrix);
    const worldPos = localPos.applyMatrix4(hit.object.matrixWorld);

    const hoverSize = MINI_CUBE_SIZE * 1.15;
    const hoverGeo = new THREE.BoxGeometry(hoverSize, hoverSize, hoverSize);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0x00cfff,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
    });
    const hoverMesh = new THREE.Mesh(hoverGeo, hoverMat);
    hoverMesh.position.copy(worldPos);
    hoverMesh.userData.isHover = true;
    this.highlightGroup.add(hoverMesh);
    this._hoverHighlight = hoverMesh;
  }

  private _clearHoverHighlight(): void {
    if (!this._hoverHighlight) return;
    this._hoverHighlight.parent?.remove(this._hoverHighlight);
    this._hoverHighlight.geometry.dispose();
    (this._hoverHighlight.material as THREE.Material).dispose();
    this._hoverHighlight = null;
    this._hoveredKey = null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Called when user clicks a mini-cube (with canvas screen coords) */
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

      // Read mode AFTER cameraController.update() so LOD changes from this frame
      // are reflected immediately in the same frame, avoiding stale evictions.
      const mode = this.cameraController.mode;

      // Update nearby high-detail chunks every frame while in micro mode
      if (mode === "micro" || mode === "nav") {
        this.chunkManager.updateLod(mode, this.cameraController.camera);
        this._nearChunks = this.chunkManager.getHighMeshes().length;
      }

      this.statsFrame++;
      if (this.statsFrame % 20 === 0 && this.statsCallback) {
        this.statsCallback({
          mode: this.representationManager.mode,
          nearChunks: this._nearChunks,
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
    this.canvas.removeEventListener("click", this._boundClick);
    this.canvas.removeEventListener("pointermove", this._boundPointerMove);
    this._clearHoverHighlight();
    this.chunkManager.dispose();
    this.cameraController.dispose();
    this.renderer.dispose();
  }
}
