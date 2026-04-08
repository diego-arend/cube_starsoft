import * as THREE from "three";
import { CameraController } from "./camera-controller";
import { RepresentationManager } from "./representation-manager";
import { FaceSelectionManager } from "./face-selection-manager";
import { ChunkManager } from "./chunk-manager";
import type { FaceId } from "./cube-data-model";

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(5, 8, 6);
    this.scene.add(ambient, dirLight);

    this.solidGroup = new THREE.Group();
    this.faceGroup = new THREE.Group();
    this.chunkGroup = new THREE.Group();
    this.scene.add(this.solidGroup, this.faceGroup, this.chunkGroup);

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
    canvas.addEventListener("dblclick", this._boundDblClick);
  }

  private _buildSolidCube(): void {
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshPhongMaterial({ color: 0x4a90d9, shininess: 40 });
    this.cubeMesh = new THREE.Mesh(geo, mat);

    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x8ab8e0 });
    const wireframe = new THREE.LineSegments(edges, lineMat);

    this.solidGroup.add(this.cubeMesh, wireframe);
  }

  private _buildFacePlanes(): void {
    const faceConfigs: Array<{
      position: THREE.Vector3;
      rotation: THREE.Euler;
      color: number;
      normalDir: THREE.Vector3;
    }> = [
      { position: new THREE.Vector3(1.001, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0), color: 0x4a90d9, normalDir: new THREE.Vector3(1, 0, 0) },
      { position: new THREE.Vector3(-1.001, 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0), color: 0x5ba854, normalDir: new THREE.Vector3(-1, 0, 0) },
      { position: new THREE.Vector3(0, 1.001, 0), rotation: new THREE.Euler(-Math.PI / 2, 0, 0), color: 0xe8a838, normalDir: new THREE.Vector3(0, 1, 0) },
      { position: new THREE.Vector3(0, -1.001, 0), rotation: new THREE.Euler(Math.PI / 2, 0, 0), color: 0xe05c5c, normalDir: new THREE.Vector3(0, -1, 0) },
      { position: new THREE.Vector3(0, 0, 1.001), rotation: new THREE.Euler(0, 0, 0), color: 0x8e5ce8, normalDir: new THREE.Vector3(0, 0, 1) },
      { position: new THREE.Vector3(0, 0, -1.001), rotation: new THREE.Euler(0, Math.PI, 0), color: 0x50bfa0, normalDir: new THREE.Vector3(0, 0, -1) },
    ];

    for (const cfg of faceConfigs) {
      const planeGeo = new THREE.PlaneGeometry(2, 2);
      const planeMat = new THREE.MeshBasicMaterial({ color: cfg.color, side: THREE.FrontSide });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.position.copy(cfg.position);
      plane.rotation.copy(cfg.rotation);
      this.faceGroup.add(plane);
    }
  }

  private _onDblClick(e: MouseEvent): void {
    if (this.cameraController.mode !== "cube" || this.cameraController.isAnimating) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.cameraController.camera);
    const hits = this.raycaster.intersectObject(this.cubeMesh, false);
    if (!hits.length || !hits[0].face) return;

    const localNormal = hits[0].face.normal.clone();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(this.cubeMesh.matrixWorld);
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
    this.representationManager.forceMode("solid");
    this._hint = "Voltando ao cubo…";

    this.cameraController.animateToCube(() => {
      this._activeFace = "+Z";
      this._hint = "Duplo clique em uma face para inspecioná-la";
    });
  }

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
    this.chunkManager.dispose();
    this.cameraController.dispose();
    this.renderer.dispose();
  }
}
