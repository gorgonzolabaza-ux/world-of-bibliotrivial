import * as THREE from 'three';

export type Race = 'human' | 'elf' | 'dwarf' | 'orc';

export function createPlayerMesh(race: Race, color: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf1c27d, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true });

  // body
  const bodyGeom = new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8);
  const body = new THREE.Mesh(bodyGeom, mat);
  body.position.y = 0.6;
  group.add(body);

  // head
  const headGeom = new THREE.SphereGeometry(0.32, 12, 10);
  const head = new THREE.Mesh(headGeom, skin);
  head.position.y = 1.25;
  group.add(head);

  // legs
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6), dark);
    leg.position.set(s * 0.15, 0.2, 0);
    group.add(leg);
  }

  // arms
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), mat);
    arm.position.set(s * 0.45, 0.75, 0);
    arm.rotation.z = s * 0.3;
    group.add(arm);
  }

  // race features
  if (race === 'elf') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), skin);
      ear.position.set(s * 0.28, 1.45, 0);
      ear.rotation.z = s * 0.6;
      group.add(ear);
    }
  } else if (race === 'dwarf') {
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, flatShading: true }));
    beard.position.set(0, 0.95, 0.2);
    beard.rotation.x = Math.PI;
    group.add(beard);
    body.scale.y = 0.85;
    head.position.y = 1.05;
  } else if (race === 'orc') {
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xffffee, flatShading: true });
    for (const s of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), tuskMat);
      tusk.position.set(s * 0.12, 1.0, 0.25);
      tusk.rotation.x = -0.6;
      group.add(tusk);
    }
    mat.color.set(0x5a7a3a);
    skin.color.set(0x7a9a5a);
  }

  group.userData.race = race;
  return group;
}
