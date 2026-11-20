import * as THREE from 'three';

export interface HeartBalloonItem {
  index: number;
  root: THREE.Group;
  balloonPivot: THREE.Group;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  poppedTimer: number;
  bounceBoost: number;
  colorHex: string;
}

export interface HeartBalloonRig {
  group: THREE.Group;
  balloons: HeartBalloonItem[];
  state: {
    visibleScale: number;
  };
  setEdgeX: (edgeX: number) => void;
  tapBalloon: (index: number) => { x: number; y: number; z: number } | null;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

const _worldPos = new THREE.Vector3();

function createHeartBalloonGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.26);
  shape.bezierCurveTo(0.036, -0.245, 0.285, -0.07, 0.285, 0.13);
  shape.bezierCurveTo(0.285, 0.275, 0.13, 0.32, 0.0, 0.18);
  shape.bezierCurveTo(-0.13, 0.32, -0.285, 0.275, -0.285, 0.13);
  shape.bezierCurveTo(-0.285, -0.07, -0.036, -0.245, 0, -0.26);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelSegments: 10,
    steps: 2,
    bevelSize: 0.078,
    bevelThickness: 0.078,
    curveSegments: 24,
  });
  geo.center();
  return geo;
}

export function createHeartBalloonCluster(): HeartBalloonRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const group = new THREE.Group();
  const leftCluster = new THREE.Group();
  const rightCluster = new THREE.Group();
  leftCluster.position.set(-2.9, 0, -0.28);
  rightCluster.position.set(2.9, 0, -0.28);
  group.add(leftCluster, rightCluster);

  const heartGeo = trackGeo(createHeartBalloonGeometry());
  const neckGeo = trackGeo(new THREE.ConeGeometry(0.036, 0.055, 12));
  const collarGeo = trackGeo(new THREE.TorusGeometry(0.028, 0.009, 8, 16));
  collarGeo.rotateX(Math.PI / 2);

  const goldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0ca86,
      metalness: 0.85,
      roughness: 0.22,
    })
  );

  const ribbonStringMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffeef4,
      roughness: 0.35,
      metalness: 0.15,
    })
  );

  // Weighted gold floor anchors holding left & right edge balloon clusters cleanly at y = 0
  const anchorBaseGeo = trackGeo(new THREE.CylinderGeometry(0.085, 0.105, 0.075, 18));
  [leftCluster, rightCluster].forEach((cluster) => {
    const anchor = new THREE.Mesh(anchorBaseGeo, goldMat);
    anchor.position.set(0, 0.037, 0);
    anchor.castShadow = true;
    anchor.receiveShadow = true;
    cluster.add(anchor);
  });

  // Relative offsets within each edge cluster so left & right float cleanly on both outer edges
  const specs = [
    { side: 'left' as const, x: -0.22, y: 2.08, z: 0.08, color: '#ff7eb0', sheen: '#ffe2ee', rotY: 0.26, phase: 0.0 },
    { side: 'left' as const, x: 0.15, y: 2.66, z: -0.08, color: '#f3a4d4', sheen: '#fff5fb', rotY: 0.16, phase: 1.5 },
    { side: 'right' as const, x: -0.15, y: 2.66, z: -0.08, color: '#ff9680', sheen: '#ffebe5', rotY: -0.16, phase: 2.9 },
    { side: 'right' as const, x: 0.22, y: 2.04, z: 0.08, color: '#d098f7', sheen: '#f5e8ff', rotY: -0.26, phase: 4.3 },
  ];

  const balloons: HeartBalloonItem[] = [];

  specs.forEach((s, idx) => {
    const cluster = s.side === 'left' ? leftCluster : rightCluster;
    const root = new THREE.Group();

    // Helical ribbon string tying floor anchor smoothly up to balloon neck
    const stringPts: THREE.Vector3[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const sx =
        THREE.MathUtils.lerp(0, s.x, t) +
        Math.sin(t * Math.PI * 5 + idx) * 0.032 * Math.sin(t * Math.PI);
      const sy = THREE.MathUtils.lerp(0.07, s.y - 0.26, t);
      const sz =
        THREE.MathUtils.lerp(0, s.z, t) +
        Math.cos(t * Math.PI * 5 + idx) * 0.032 * Math.sin(t * Math.PI);
      stringPts.push(new THREE.Vector3(sx, sy, sz));
    }
    const stringGeo = trackGeo(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stringPts), 24, 0.006, 6, false)
    );
    const stringMesh = new THREE.Mesh(stringGeo, ribbonStringMat);
    root.add(stringMesh);

    const balloonPivot = new THREE.Group();
    balloonPivot.position.set(s.x, s.y, s.z);
    balloonPivot.rotation.y = s.rotY;
    root.add(balloonPivot);

    const balloonMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(s.color),
        roughness: 0.14,
        metalness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        sheen: 0.75,
        sheenColor: new THREE.Color(s.sheen),
        emissive: new THREE.Color(s.color),
        emissiveIntensity: 0.2,
      })
    );

    const heartMesh = new THREE.Mesh(heartGeo, balloonMat);
    heartMesh.castShadow = true;
    balloonPivot.add(heartMesh);

    const neck = new THREE.Mesh(neckGeo, balloonMat);
    neck.position.set(0, -0.265, 0);
    balloonPivot.add(neck);

    const collar = new THREE.Mesh(collarGeo, goldMat);
    collar.position.set(0, -0.242, 0);
    balloonPivot.add(collar);

    cluster.add(root);
    balloons.push({
      index: idx,
      root,
      balloonPivot,
      baseX: s.x,
      baseY: s.y,
      baseZ: s.z,
      phase: s.phase,
      poppedTimer: 0,
      bounceBoost: 0,
      colorHex: s.color,
    });
  });

  const state = {
    visibleScale: 0,
  };

  function setEdgeX(edgeX: number) {
    leftCluster.position.x = -Math.abs(edgeX);
    rightCluster.position.x = Math.abs(edgeX);
  }

  function tapBalloon(index: number): { x: number; y: number; z: number } | null {
    const b = balloons[index];
    if (!b || b.poppedTimer > 0) return null;
    b.poppedTimer = 1.65; // Pops into hearts & re-inflates cleanly after 1.65s!
    b.bounceBoost = 1;
    b.balloonPivot.getWorldPosition(_worldPos);
    return {
      x: _worldPos.x,
      y: _worldPos.y,
      z: _worldPos.z,
    };
  }

  function update(dt: number, elapsed: number) {
    const safeDt = Math.min(dt, 0.05);
    const vis = THREE.MathUtils.clamp(state.visibleScale, 0, 1);
    group.visible = vis > 0.01;
    if (!group.visible) return;

    leftCluster.scale.setScalar(vis);
    rightCluster.scale.setScalar(vis);

    for (let i = 0; i < balloons.length; i++) {
      const b = balloons[i];
      if (b.poppedTimer > 0) {
        b.poppedTimer = Math.max(0, b.poppedTimer - safeDt);
        const inflate = b.poppedTimer < 0.45 ? 1 - b.poppedTimer / 0.45 : 0;
        const s = Math.max(0.001, inflate);
        b.balloonPivot.scale.setScalar(s);
        b.balloonPivot.visible = inflate > 0.02;
      } else {
        b.balloonPivot.visible = true;
        b.balloonPivot.scale.setScalar(1);
      }

      const bobY = Math.sin(elapsed * 1.45 + b.phase) * 0.11;
      const swayX = Math.cos(elapsed * 1.05 + b.phase) * 0.055;
      const tiltZ = Math.sin(elapsed * 1.2 + b.phase) * 0.09;

      b.balloonPivot.position.set(b.baseX + swayX, b.baseY + bobY, b.baseZ);
      b.balloonPivot.rotation.z = tiltZ;
    }
  }

  return {
    group,
    balloons,
    state,
    setEdgeX,
    tapBalloon,
    update,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
