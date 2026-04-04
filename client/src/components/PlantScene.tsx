import { useEffect, useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { useGame } from "@/contexts/GameContext";

const COLORS = {
  soil: 0x8d6e63,
  soilDark: 0x6d4c41,
  pot: 0xd7ccc8,
  potDark: 0xbcaaa4,
  potRim: 0xa1887f,
  stem: 0x558b2f,
  leaf: 0x7cb342,
  leafLight: 0x9ccc65,
  leafDark: 0x558b2f,
  flower: 0xf48fb1,
  flowerLight: 0xf8bbd0,
  flowerCenter: 0xfff176,
  trunk: 0x795548,
  trunkDark: 0x5d4037,
  particle: 0xffd54f,
  seedColor: 0x4e342e,
};

function createPot(scene: THREE.Scene) {
  // 花盆尺寸缩小到 75%
  const potGeo = new THREE.CylinderGeometry(0.41, 0.3, 0.49, 24);
  const potMat = new THREE.MeshStandardMaterial({
    color: COLORS.pot,
    roughness: 0.6,
    metalness: 0.05,
  });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.y = 0.245;
  pot.castShadow = true;
  pot.receiveShadow = true;
  scene.add(pot);

  const innerGeo = new THREE.CylinderGeometry(0.375, 0.375, 0.075, 24);
  const innerMat = new THREE.MeshStandardMaterial({
    color: COLORS.potDark,
    roughness: 0.8,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.position.y = 0.465;
  scene.add(inner);

  const rimGeo = new THREE.TorusGeometry(0.428, 0.03, 12, 24);
  const rimMat = new THREE.MeshStandardMaterial({
    color: COLORS.potRim,
    roughness: 0.5,
    metalness: 0.1,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.488;
  rim.rotation.x = Math.PI / 2;
  scene.add(rim);

  // 土壤 - 仅生成花盆顶部可见的土块
  const soilColors = [0x3e2723, 0x4e342e, 0x5d4037, 0x6d4c41];

  // 表层土块 - 铺满花盆顶部表面
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const size = 0.05 + Math.random() * 0.05;
    // 花盆顶部内半径约 0.375，预留土块半径+边距确保不溢出
    const maxR = 0.35 - size * 0.8;
    // 中心留出空间给植物茎干
    const r = 0.05 + Math.random() * (maxR - 0.05);
    const soilGeo = new THREE.SphereGeometry(size, 7, 5);
    const soilMat = new THREE.MeshStandardMaterial({
      color: soilColors[Math.floor(Math.random() * soilColors.length)],
      roughness: 1.0,
    });
    const soil = new THREE.Mesh(soilGeo, soilMat);
    // 边缘略高形成自然土堆效果
    const heightBoost = r > 0.20 ? 0.018 : 0;
    soil.position.set(
      Math.cos(angle) * r,
      0.47 + heightBoost + Math.random() * 0.015,
      Math.sin(angle) * r
    );
    soil.scale.y = 0.7;
    scene.add(soil);
  }

  // 点缀的小石子
  const stoneColors = [0xd7ccc8, 0xbcaaa4, 0xa1887f];
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const stoneSize = 0.02 + Math.random() * 0.02;
    // 限制在花盆顶部范围内
    const maxR = 0.35 - stoneSize;
    const r = 0.1 + Math.random() * (maxR - 0.1);
    const stoneGeo = new THREE.SphereGeometry(stoneSize, 6, 5);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: stoneColors[Math.floor(Math.random() * stoneColors.length)],
      roughness: 0.6,
    });
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.position.set(
      Math.cos(angle) * r,
      0.49 + Math.random() * 0.015,
      Math.sin(angle) * r
    );
    stone.scale.set(1.2, 0.9, 1.2);
    scene.add(stone);
  }
}

function createSeed(group: THREE.Group) {
  const seedGeo = new THREE.SphereGeometry(0.09, 16, 16);
  seedGeo.scale(1.2, 0.8, 1);
  const seedMat = new THREE.MeshStandardMaterial({
    color: COLORS.seedColor,
    roughness: 0.6,
    metalness: 0.05,
  });
  const seed = new THREE.Mesh(seedGeo, seedMat);
  seed.position.y = 0.51;
  seed.rotation.z = 0.15;
  seed.castShadow = true;
  group.add(seed);

  const crackGeo = new THREE.SphereGeometry(0.023, 8, 8);
  const crackMat = new THREE.MeshStandardMaterial({
    color: COLORS.leaf,
    emissive: COLORS.leaf,
    emissiveIntensity: 0.4,
  });
  const crack = new THREE.Mesh(crackGeo, crackMat);
  crack.position.set(0.027, 0.552, 0.027);
  group.add(crack);

  const tipGeo = new THREE.ConeGeometry(0.011, 0.036, 6);
  const tipMat = new THREE.MeshStandardMaterial({
    color: COLORS.leafLight,
    emissive: COLORS.leafLight,
    emissiveIntensity: 0.3,
  });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.set(0.027, 0.578, 0.027);
  group.add(tip);

}

function createSprout(group: THREE.Group) {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.0, 0.48, 0.0),
      new THREE.Vector3(0.015, 0.58, 0.01),
      new THREE.Vector3(-0.012, 0.70, -0.015),
      new THREE.Vector3(0.01, 0.83, 0.01),
      new THREE.Vector3(0.0, 0.92, 0.0),
    ],
    false,
    "centripetal",
    0.5
  );

  const baseR = 0.010;
  const stemGeo = new THREE.TubeGeometry(curve, 28, baseR, 12, false);

  // ✅ 正确 taper：围绕中心线收细（保留沿切线方向分量，只缩径向分量）
  {
    const pos = stemGeo.attributes.position as THREE.BufferAttribute;
    const uv = stemGeo.attributes.uv as THREE.BufferAttribute;

    const center = new THREE.Vector3();
    const vtx = new THREE.Vector3();
    const off = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const along = new THREE.Vector3();
    const radial = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i); // 0..1
      curve.getPointAt(u, center);
      curve.getTangentAt(u, tan).normalize();

      vtx.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      off.subVectors(vtx, center);

      along.copy(tan).multiplyScalar(off.dot(tan));
      radial.copy(off).sub(along);

      const taper = THREE.MathUtils.lerp(1.05, 0.55, u);
      radial.multiplyScalar(taper);

      vtx.copy(center).add(along).add(radial);
      pos.setXYZ(i, vtx.x, vtx.y, vtx.z);
    }

    pos.needsUpdate = true;
    stemGeo.computeVertexNormals();
  }

  const stemMat = new THREE.MeshStandardMaterial({
    color: COLORS.stem,
    roughness: 0.75,
    metalness: 0.0,
  });

  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.castShadow = true;
  stem.receiveShadow = true;
  group.add(stem);

  // 茎顶端封口（避免看起来像空心管子）
  const topCapGeo = new THREE.CircleGeometry(baseR * 0.55, 12);
  const topCap = new THREE.Mesh(topCapGeo, stemMat);
  const topPoint = curve.getPoint(1);
  const topTan = curve.getTangent(1).normalize();
  topCap.position.copy(topPoint);
  topCap.lookAt(topPoint.clone().add(topTan));
  group.add(topCap);

  // ✅ 叶子：根部锚定在 y=0，才能“贴”到茎上
  function makeLeafGeometry() {
    const width = 0.12;
    const height = 0.22;

    const geo = new THREE.PlaneGeometry(width, height, 24, 32);
    geo.translate(0, height / 2, 0); // 关键：把“叶根”移到原点

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const p = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const t = THREE.MathUtils.clamp(p.y / height, 0, 1); // 0..1 从根到尖

      const profile = Math.pow(Math.sin(Math.PI * t), 0.65);
      p.x *= profile;

      const mid = 1 - Math.min(1, Math.abs(p.x) / (width * 0.5 + 1e-6));
      p.z += mid * Math.sin(t * Math.PI) * 0.03;

      pos.setXYZ(i, p.x, p.y, p.z);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  const leafGeo = makeLeafGeometry();
  const leafMat1 = new THREE.MeshStandardMaterial({
    color: COLORS.leaf,
    roughness: 0.55,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const leafMat2 = leafMat1.clone();
  (leafMat2 as THREE.MeshStandardMaterial).color.setHex(COLORS.leafLight);

  // 把叶子贴在茎表面：用 t 对应的茎半径做偏移，保证“连上”
  const worldUpA = new THREE.Vector3(0, 1, 0);
  const worldUpB = new THREE.Vector3(0, 0, 1);

  function addLeaf(t: number, sideSign: number, mat: THREE.Material) {
    const leaf = new THREE.Mesh(leafGeo, mat);
    leaf.castShadow = true;

    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();

    const up = Math.abs(tangent.dot(worldUpA)) > 0.9 ? worldUpB : worldUpA;
    const side = new THREE.Vector3().crossVectors(up, tangent).normalize().multiplyScalar(sideSign);

    // 叶子的“生长方向”：主要向侧面，略向上沿茎
    const dir = side.clone().add(tangent.clone().multiplyScalar(0.22)).normalize();
    leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);


    // 茎在该 t 的“近似半径”
    const stemR = baseR * THREE.MathUtils.lerp(1.05, 0.55, t);
    leaf.position.copy(p).addScaledVector(side, stemR + 0.004).addScaledVector(up, 0.002);

    group.add(leaf);
  }

  addLeaf(0.90, +1, leafMat1);
  addLeaf(0.90, -1, leafMat2);
}

function createGrass(group: THREE.Group) {
  // 主茎（比 sprout 更高、更直、更粗一点）
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.0, 0.48, 0.0),
      new THREE.Vector3(0.02, 0.70, 0.01),
      new THREE.Vector3(-0.015, 0.92, -0.01),
      new THREE.Vector3(0.0, 1.15, 0.0),
    ],
    false,
    "centripetal",
    0.5
  );

  const baseR = 0.018;
  const stemGeo = new THREE.TubeGeometry(curve, 22, baseR, 10, false);

  // taper：同样用中心线 taper（别用 multiplyScalar）
  {
    const pos = stemGeo.attributes.position as THREE.BufferAttribute;
    const uv = stemGeo.attributes.uv as THREE.BufferAttribute;

    const center = new THREE.Vector3();
    const vtx = new THREE.Vector3();
    const off = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const along = new THREE.Vector3();
    const radial = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i);
      curve.getPointAt(u, center);
      curve.getTangentAt(u, tan).normalize();

      vtx.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      off.subVectors(vtx, center);

      along.copy(tan).multiplyScalar(off.dot(tan));
      radial.copy(off).sub(along);

      const taper = THREE.MathUtils.lerp(1.0, 0.55, Math.pow(u, 1.1));
      radial.multiplyScalar(taper);

      vtx.copy(center).add(along).add(radial);
      pos.setXYZ(i, vtx.x, vtx.y, vtx.z);
    }

    pos.needsUpdate = true;
    stemGeo.computeVertexNormals();
  }

  const stemMat = new THREE.MeshStandardMaterial({
    color: COLORS.stem,
    roughness: 0.8,
    metalness: 0.0,
  });

  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.castShadow = true;
  stem.receiveShadow = true;
  group.add(stem);

  // 真叶（比 cotyledon 更修长）
  function makeTrueLeafGeo(w: number, h: number) {
    const geo = new THREE.PlaneGeometry(w, h, 20, 28);
    geo.translate(0, h / 2, 0); // 叶根锚定

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const p = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const t = THREE.MathUtils.clamp(p.y / h, 0, 1);

      // 披针形：中部最宽，尖端更尖
      const profile = Math.pow(Math.sin(Math.PI * t), 0.55);
      p.x *= profile;

      // 更轻的卷曲
      const mid = 1 - Math.min(1, Math.abs(p.x) / (w * 0.5 + 1e-6));
      p.z += mid * Math.sin(t * Math.PI) * 0.02;

      pos.setXYZ(i, p.x, p.y, p.z);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  const leafGeo = makeTrueLeafGeo(0.15, 0.34);

  const leafMatA = new THREE.MeshStandardMaterial({
    color: COLORS.leaf,
    roughness: 0.6,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const leafMatB = leafMatA.clone();
  (leafMatB as THREE.MeshStandardMaterial).color.setHex(COLORS.leafLight);

  const worldUpA = new THREE.Vector3(0, 1, 0);
  const worldUpB = new THREE.Vector3(0, 0, 1);

  function addLeafAt(t: number, around: number, mat: THREE.Material, sizeScale: number) {
    const leaf = new THREE.Mesh(leafGeo, mat);
    leaf.castShadow = true;
    leaf.scale.setScalar(sizeScale);

    const p = curve.getPoint(t);
    const tan = curve.getTangent(t).normalize();
    const up = Math.abs(tan.dot(worldUpA)) > 0.9 ? worldUpB : worldUpA;

    // 先求一个侧向轴，再绕 tan 旋转，得到“环绕茎”的方向
    const side0 = new THREE.Vector3().crossVectors(up, tan).normalize();
    const qAround = new THREE.Quaternion().setFromAxisAngle(tan, around);
    const side = side0.applyQuaternion(qAround).normalize();

    // 叶生长方向：主要朝侧面，略向上
    const dir = side.clone().add(tan.clone().multiplyScalar(0.18)).normalize();
    leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    // 自然随机旋转，不刻意朝向相机
    leaf.rotateOnAxis(dir, around * 0.3 + (Math.random() - 0.5) * 0.4);

    const stemR = baseR * THREE.MathUtils.lerp(1.0, 0.55, t);
    // 贴紧茎表面
    leaf.position.copy(p).addScaledVector(side, stemR + 0.002).addScaledVector(up, -0.005);

    // 轻微向外倾斜，增加层次感
    leaf.rotateOnAxis(side, -0.25 + Math.random() * 0.15);

    group.add(leaf);
  }

  // 5片叶，均匀分布避免重叠
  addLeafAt(0.52, 0.0, leafMatA, 1.0);
  addLeafAt(0.64, 2.5, leafMatB, 0.90);
  addLeafAt(0.75, 5.0, leafMatA, 0.82);
  addLeafAt(0.84, 1.2, leafMatB, 0.75);
  addLeafAt(0.91, 3.8, leafMatA, 0.68);
}

function createBush(group: THREE.Group) {
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.48, 0),
    new THREE.Vector3(0.02, 0.68, 0.01),
    new THREE.Vector3(-0.01, 0.88, -0.005),
    new THREE.Vector3(0.0, 1.05, 0),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, 0.028, 8, false);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: COLORS.trunk,
    roughness: 0.9,
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  group.add(trunk);

  // 树干顶端封口
  const trunkTopGeo = new THREE.CircleGeometry(0.028, 12);
  const trunkTop = new THREE.Mesh(trunkTopGeo, trunkMat);
  const trunkTopPoint = trunkCurve.getPoint(1);
  const trunkTopTan = trunkCurve.getTangent(1).normalize();
  trunkTop.position.copy(trunkTopPoint);
  trunkTop.lookAt(trunkTopPoint.clone().add(trunkTopTan));
  group.add(trunkTop);

  const positions = [
    { pos: [0, 1.25, 0], r: 0.20, color: COLORS.leaf },
    { pos: [0.15, 1.18, 0.09], r: 0.16, color: COLORS.leafDark },
    { pos: [-0.12, 1.19, -0.07], r: 0.15, color: COLORS.leafLight },
    { pos: [0.07, 1.30, -0.06], r: 0.13, color: COLORS.leaf },
    { pos: [-0.10, 1.24, 0.11], r: 0.14, color: COLORS.leafDark },
    { pos: [0.12, 1.15, -0.10], r: 0.12, color: COLORS.leafLight },
  ];

  positions.forEach(({ pos, r, color }) => {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    group.add(mesh);
  });
}

function createSmallTree(group: THREE.Group) {
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.48, 0),
    new THREE.Vector3(0.026, 0.653, 0.009),
    new THREE.Vector3(-0.009, 0.875, -0.018),
    new THREE.Vector3(0.018, 1.118, 0),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 16, 0.040, 8, false);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: COLORS.trunk,
    roughness: 0.9,
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  group.add(trunk);

  // 树干顶端封口
  const trunkTopGeo = new THREE.CircleGeometry(0.040, 12);
  const trunkTop = new THREE.Mesh(trunkTopGeo, trunkMat);
  const trunkTopPoint = trunkCurve.getPoint(1);
  const trunkTopTan = trunkCurve.getTangent(1).normalize();
  trunkTop.position.copy(trunkTopPoint);
  trunkTop.lookAt(trunkTopPoint.clone().add(trunkTopTan));
  group.add(trunkTop);

  const branches = [
    { start: [0.018, 0.9, 0], end: [0.162, 1.043, 0.045], r: 0.018 },
    { start: [-0.009, 0.99, -0.009], end: [-0.126, 1.133, -0.072], r: 0.0162 },
    { start: [0.009, 0.825, 0.018], end: [0.108, 0.869, 0.135], r: 0.0132 },
  ];

  branches.forEach(({ start, end, r }) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...start),
      new THREE.Vector3(
        (start[0] + end[0]) / 2 + (Math.random() - 0.5) * 0.038,
        (start[1] + end[1]) / 2,
        (start[2] + end[2]) / 2
      ),
      new THREE.Vector3(...end),
    ]);
    const geo = new THREE.TubeGeometry(curve, 8, r, 6, false);
    const mesh = new THREE.Mesh(geo, trunkMat);
    group.add(mesh);

    // 分支顶端封口
    const branchTopGeo = new THREE.CircleGeometry(r, 8);
    const branchTop = new THREE.Mesh(branchTopGeo, trunkMat);
    const endPoint = curve.getPoint(1);
    const endTan = curve.getTangent(1).normalize();
    branchTop.position.copy(endPoint);
    branchTop.lookAt(endPoint.clone().add(endTan));
    group.add(branchTop);
  });

  const clusters = [
    { pos: [0, 1.25, 0], r: 0.21, color: COLORS.leaf },
    { pos: [0.158, 1.16, 0.084], r: 0.158, color: COLORS.leafDark },
    { pos: [-0.126, 1.203, -0.063], r: 0.168, color: COLORS.leafLight },
    { pos: [0.084, 1.34, -0.053], r: 0.137, color: COLORS.leaf },
    { pos: [-0.053, 1.296, 0.126], r: 0.147, color: COLORS.leafDark },
    { pos: [0.189, 1.07, 0.126], r: 0.116, color: COLORS.leafLight },
    { pos: [-0.158, 1.121, 0.053], r: 0.126, color: COLORS.leaf },
  ];

  clusters.forEach(({ pos, r, color }) => {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    group.add(mesh);
  });
}

function createFlowerTree(group: THREE.Group) {
  // ===== Trunk (keep original) =====
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.48, 0),
    new THREE.Vector3(0.036, 0.668, 0.018),
    new THREE.Vector3(-0.018, 0.9, -0.009),
    new THREE.Vector3(0.026, 1.143, 0.009),
    new THREE.Vector3(0, 1.35, 0),
  ]);

  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 20, 0.055, 8, false);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: COLORS.trunk,
    roughness: 0.85,
  });

  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // ===== Branches (keep original look, but snap start to trunk + hide seam) =====
  const branches = [
    { start: [0.026, 1.08, 0.009], end: [0.198, 1.238, 0.072], r: 0.0228 },
    { start: [-0.018, 1.17, -0.009], end: [-0.162, 1.306, -0.09], r: 0.0198 },
    { start: [0.009, 0.99, 0.018], end: [0.135, 1.036, 0.162], r: 0.0162 },
    { start: [-0.009, 0.9, -0.018], end: [-0.108, 0.972, -0.135], r: 0.0144 },
  ];

  const trunkY0 = 0.48;
  const trunkY1 = 1.35;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  branches.forEach(({ start, end, r }) => {
    const startOld = new THREE.Vector3(start[0], start[1], start[2]);
    const endOld = new THREE.Vector3(end[0], end[1], end[2]);

    // snap start onto trunk curve using y-param (trunk y is monotone here)
    const t = clamp01((startOld.y - trunkY0) / (trunkY1 - trunkY0));
    const startNew = trunkCurve.getPointAt(t);

    // preserve original branch direction by shifting end with the same delta
    const delta = startNew.clone().sub(startOld);
    const endNew = endOld.clone().add(delta);

    const mid = startNew.clone().lerp(endNew, 0.5);
    mid.y += 0.0225;

    const c = new THREE.CatmullRomCurve3([startNew, mid, endNew]);
    const geo = new THREE.TubeGeometry(c, 8, r, 6, false);
    const mesh = new THREE.Mesh(geo, trunkMat);
    mesh.castShadow = true;
    group.add(mesh);

    // seam hider
    const joint = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 10, 8), trunkMat);
    joint.position.copy(startNew);
    joint.castShadow = true;
    group.add(joint);

    // branch end cap (prevent hollow look)
    const endCap = new THREE.Mesh(new THREE.CircleGeometry(r, 8), trunkMat);
    endCap.position.copy(endNew);
    const endTan = c.getTangent(1).normalize();
    endCap.lookAt(endNew.clone().add(endTan));
    group.add(endCap);
  });

  // ===== Foliage (keep original) =====
  const foliageClusters = [
    { pos: [0, 1.485, 0], r: 0.231, color: COLORS.leaf },
    { pos: [0.189, 1.388, 0.105], r: 0.168, color: COLORS.leafDark },
    { pos: [-0.158, 1.44, -0.084], r: 0.179, color: COLORS.leafLight },
    { pos: [0.105, 1.576, -0.063], r: 0.147, color: COLORS.leaf },
    { pos: [-0.084, 1.53, 0.147], r: 0.158, color: COLORS.leafDark },
    { pos: [0.21, 1.306, 0.147], r: 0.126, color: COLORS.leafLight },
    { pos: [-0.189, 1.35, 0.084], r: 0.137, color: COLORS.leaf },
  ];

  foliageClusters.forEach(({ pos, r, color }) => {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    group.add(mesh);
  });

  // ===== Flowers: place on outer clusters, facing outward from tree center =====
  const flowerMat = new THREE.MeshStandardMaterial({
    color: COLORS.flower,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const flowerLightMat = new THREE.MeshStandardMaterial({
    color: COLORS.flowerLight,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: COLORS.flowerCenter,
    emissive: COLORS.flowerCenter,
    emissiveIntensity: 0.4,
  });

  const treeCenter = new THREE.Vector3(0, 1.45, 0);

  // Flowers: 顶部不要有花朵，只放在侧面簇上
  const flowerSpots = [
    { pos: [0.189, 1.388, 0.105], r: 0.168, dir: new THREE.Vector3(0.8, 0.3, 0.5) },   // right-front
    { pos: [-0.158, 1.44, -0.084], r: 0.179, dir: new THREE.Vector3(-0.7, 0.4, -0.6) }, // left-back
    { pos: [0.105, 1.576, -0.063], r: 0.147, dir: new THREE.Vector3(0.5, 0.6, -0.6) },   // front-left
    { pos: [-0.084, 1.53, 0.147], r: 0.158, dir: new THREE.Vector3(-0.4, 0.5, 0.8) },    // back-right
    { pos: [0.21, 1.306, 0.147], r: 0.126, dir: new THREE.Vector3(0.9, 0.1, 0.4) },      // low-right
    { pos: [-0.189, 1.35, 0.084], r: 0.137, dir: new THREE.Vector3(-0.9, 0.2, 0.3) },     // low-left
  ];

  flowerSpots.forEach(({ pos, r, dir }, idx) => {
    const clusterCenter = new THREE.Vector3(pos[0], pos[1], pos[2]);

    // Normalize direction and ensure it points away from tree center
    const outwardDir = dir.clone().normalize();

    // Position: 贴树冠更近 (从 r + 0.02 改为 r + 0.005)
    const surfacePos = clusterCenter.clone().addScaledVector(outwardDir, r + 0.005);

    const flower = new THREE.Group();
    flower.position.copy(surfacePos);

    // Orient flower to face outward
    flower.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outwardDir);
    flower.rotateZ(Math.random() * Math.PI * 2);

    // petals - 厚度更小 (radius 从 0.032 改为 0.024, scale 更扁)
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      const petalGeo = new THREE.SphereGeometry(0.024, 7, 7);
      petalGeo.scale(1, 0.5, 0.8);

      const petal = new THREE.Mesh(petalGeo, idx % 2 === 0 ? flowerMat : flowerLightMat);
      petal.position.set(Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0.003);
      petal.rotation.z = a;
      petal.rotation.x = 0.12;
      petal.castShadow = true;
      flower.add(petal);
    }

    const centerMesh = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), centerMat);
    centerMesh.position.set(0, 0, 0.012);
    centerMesh.castShadow = true;
    flower.add(centerMesh);

    group.add(flower);
  });
}

const STAGE_CREATORS: Record<string, (group: THREE.Group) => void> = {
  seed: createSeed,
  sprout: createSprout,
  grass: createGrass,
  bush: createBush,
  small_tree: createSmallTree,
  flower_tree: createFlowerTree,
};

interface PlantSceneProps {
  previewStage?: string | null;
  onPlantClick?: () => void;
}

export default function PlantScene({ previewStage, onPlantClick }: PlantSceneProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    plantGroup: THREE.Group;
    particles: THREE.Points;
    animId: number;
    autoRotateSpeed: number;
    targetRotationY: number;
    currentRotationY: number;
  } | null>(null);
  const { currentPlantStage } = useGame();
  const [isLoading, setIsLoading] = useState(true);
  const onPlantClickRef = useRef(onPlantClick);
  const clickRaycasterRef = useRef(new THREE.Raycaster());
  const clickPointerRef = useRef(new THREE.Vector2());

  useEffect(() => {
    onPlantClickRef.current = onPlantClick;
  }, [onPlantClick]);

  // 如果有预览阶段则使用，否则使用当前阶段
  const stageImage = useMemo(() => {
    if (previewStage) return previewStage;
    return currentPlantStage.image;
  }, [currentPlantStage, previewStage]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0.3, 2.2, 3.8);
    camera.lookAt(0, 1.1, 0);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = "pointer";

    const ambientLight = new THREE.AmbientLight(0xfff8e1, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
    sunLight.position.set(3, 6, 3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 512;
    sunLight.shadow.mapSize.height = 512;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 15;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xbbdefb, 0.35);
    fillLight.position.set(-3, 4, -2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfce4ec, 0.25);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    const groundGeo = new THREE.PlaneGeometry(4, 4);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    createPot(scene);

    const plantGroup = new THREE.Group();
    scene.add(plantGroup);

    // 优化：减少粒子数量以提高性能
    const particleCount = 12;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 2.5;
      particlePositions[i * 3 + 1] = 0.3 + Math.random() * 2.2;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
      particleSizes[i] = 0.015 + Math.random() * 0.025;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: COLORS.particle,
      size: 0.035,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    let mouseX = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 0.3;
    };
    window.addEventListener("mousemove", onMouseMove);

    let time = 0;
    let currentRotY = 0;
    let frameCount = 0;
    
    // 初始化场景后隐藏加载状态
    setIsLoading(false);
    
    function animate() {
      frameCount++;
      time += 0.008;

      // 植物摇摆动画（每帧都更新）
      plantGroup.rotation.z = Math.sin(time * 0.6) * 0.015;
      plantGroup.rotation.x = Math.cos(time * 0.4) * 0.008;
      plantGroup.position.y = Math.sin(time * 0.8) * 0.005;
      
      // 植物缓慢旋转（幅度显著）
      plantGroup.rotation.y = Math.sin(time * 0.12) * 0.35;

      // 鼠标跟随（平滑插值）
      currentRotY += (mouseX - currentRotY) * 0.02;
      scene.rotation.y = currentRotY;

      // 粒子动画（每2帧更新一次以优化性能）
      if (frameCount % 2 === 0) {
        const positions = particles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3 + 1] += 0.003 + Math.sin(time + i * 0.5) * 0.001;
          if (positions[i * 3 + 1] > 2.8) {
            positions[i * 3 + 1] = 0.3;
            positions[i * 3] = (Math.random() - 0.5) * 2.5;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
          }
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particleMat.opacity = 0.4 + Math.sin(time * 0.8) * 0.15;
      }

      renderer.render(scene, camera);
      sceneRef.current!.animId = requestAnimationFrame(animate);
    }

    const animId = requestAnimationFrame(animate);

    sceneRef.current = { 
      scene, 
      camera, 
      renderer, 
      plantGroup, 
      particles, 
      animId,
      autoRotateSpeed: 0.0025,
      targetRotationY: 0,
      currentRotationY: 0
    };

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const onCanvasClick = (event: MouseEvent) => {
      if (!sceneRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      clickPointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      clickPointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      clickRaycasterRef.current.setFromCamera(clickPointerRef.current, camera);
      const intersects = clickRaycasterRef.current.intersectObjects(plantGroup.children, true);
      if (intersects.length > 0) {
        onPlantClickRef.current?.();
      }
    };
    renderer.domElement.addEventListener("click", onCanvasClick);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { plantGroup } = sceneRef.current;

    while (plantGroup.children.length > 0) {
      const child = plantGroup.children[0];
      plantGroup.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    }

    const creator = STAGE_CREATORS[stageImage];
    if (creator) {
      creator(plantGroup);
    }

    // 增加一个不可见点击区域，避免模型细节过小时点击难命中
    const clickArea = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 18, 18),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    clickArea.position.set(0, 1.1, 0);
    clickArea.name = "plant-click-area";
    plantGroup.add(clickArea);

    plantGroup.scale.set(0.7, 0.7, 0.7);
    let scale = 0.7;
    const growIn = () => {
      scale += (1 - scale) * 0.12;
      plantGroup.scale.set(scale, scale, scale);
      if (Math.abs(1 - scale) > 0.01) {
        requestAnimationFrame(growIn);
      } else {
        plantGroup.scale.set(1, 1, 1);
      }
    };
    requestAnimationFrame(growIn);
  }, [stageImage]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: "300px" }}>
      {/* 加载状态 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-amber-50/50 to-orange-50/50 z-10 transition-opacity duration-300">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-amber-700 text-sm font-medium">加载中...</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: "300px" }}
      />
    </div>
  );
}
