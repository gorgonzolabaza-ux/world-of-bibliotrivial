import * as THREE from 'three';

export type Race = 'human' | 'elf' | 'dwarf' | 'orc';

/**
 * Ficha del jugador. Geometría suave (sin flatShading) y piezas encadenadas:
 * botas, piernas, túnica, cinturón, hombros, brazos, manos, cuello y cabeza,
 * con los rasgos propios de cada raza.
 */
export function createPlayerMesh(race: Race, color: string): THREE.Group {
  const group = new THREE.Group();

  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.04 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.62, metalness: 0.06 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b475, metalness: 0.72, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x211a14, roughness: 0.45 });

  const skinColor = race === 'orc' ? 0x8fae6a : race === 'dwarf' ? 0xe8b98c : 0xf3cba4;
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.72 });

  const isDwarf = race === 'dwarf';
  const isOrc = race === 'orc';
  const isElf = race === 'elf';

  const legLength = isDwarf ? 0.2 : 0.36;
  const hipY = 0.11 + legLength;
  const bodyHeight = isDwarf ? 0.36 : 0.48;
  const shoulderY = hipY + bodyHeight;
  const headRadius = isDwarf ? 0.155 : 0.17;
  const headY = shoulderY + 0.1 + headRadius;

  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  /* pies */
  for (const side of [-1, 1]) {
    const foot = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.1, 6, 18), leather));
    foot.rotation.x = Math.PI / 2;
    foot.position.set(side * 0.105, 0.072, 0.035);
  }

  /* piernas */
  for (const side of [-1, 1]) {
    const leg = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.078, legLength - 0.08, 6, 20), leather));
    leg.position.set(side * 0.105, 0.1 + legLength / 2, 0);
  }

  /* túnica: falda acampanada + torso */
  const skirt = add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(isDwarf ? 0.27 : 0.245, isDwarf ? 0.34 : 0.315, bodyHeight, 32, 1),
      cloth,
    ),
  );
  skirt.position.y = hipY + bodyHeight / 2;

  const belt = add(new THREE.Mesh(new THREE.TorusGeometry(isDwarf ? 0.225 : 0.208, 0.026, 8, 40), leather));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = hipY + bodyHeight * 0.42;

  const buckle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 6), gold));
  buckle.rotation.x = Math.PI / 2;
  buckle.position.set(0, hipY + bodyHeight * 0.42, isDwarf ? 0.23 : 0.212);

  /* hombros redondeados */
  const shoulders = add(
    new THREE.Mesh(new THREE.SphereGeometry(isDwarf ? 0.25 : 0.228, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth),
  );
  shoulders.position.y = shoulderY - 0.02;

  /* brazos y manos */
  for (const side of [-1, 1]) {
    const arm = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.062, bodyHeight * 0.62, 6, 20), cloth));
    arm.position.set(side * (isDwarf ? 0.255 : 0.238), shoulderY - 0.16, 0.01);
    arm.rotation.z = side * 0.22;
    arm.rotation.x = -0.08;

    const hand = add(new THREE.Mesh(new THREE.SphereGeometry(0.056, 18, 14), skin));
    hand.position.set(side * (isDwarf ? 0.305 : 0.285), shoulderY - 0.34, 0.03);
  }

  /* cuello y cabeza */
  const neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.1, 20), skin));
  neck.position.y = shoulderY + 0.03;

  const head = add(new THREE.Mesh(new THREE.SphereGeometry(headRadius, 32, 24), skin));
  head.scale.set(1, 1.06, 0.97);
  head.position.y = headY;

  /* ojos */
  for (const side of [-1, 1]) {
    const eye = add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), dark));
    eye.position.set(side * 0.058, headY + 0.022, headRadius * 0.9);
  }

  /* pelo / capucha */
  const hair = add(
    new THREE.Mesh(new THREE.SphereGeometry(headRadius * 1.06, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.46), leather),
  );
  hair.position.y = headY + 0.028;
  hair.rotation.x = -0.22;

  /* rasgos de raza */
  if (isElf) {
    for (const side of [-1, 1]) {
      const ear = add(new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.16, 14), skin));
      ear.position.set(side * (headRadius * 1.02), headY + 0.03, -0.01);
      ear.rotation.z = side * -0.9;
      ear.rotation.y = side * 0.2;
    }
  } else if (isDwarf) {
    const beard = add(new THREE.Mesh(new THREE.ConeGeometry(headRadius * 0.95, 0.26, 22), new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.85 })));
    beard.position.set(0, headY - headRadius * 0.85, headRadius * 0.35);
    beard.rotation.x = Math.PI;
    const nose = add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), skin));
    nose.position.set(0, headY - 0.01, headRadius * 0.96);
  } else if (isOrc) {
    for (const side of [-1, 1]) {
      const tusk = add(new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xf2ecd8, roughness: 0.4 })));
      tusk.position.set(side * 0.055, headY - 0.075, headRadius * 0.85);
      tusk.rotation.x = -0.5;
    }
    const brow = add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 0.05), dark));
    brow.position.set(0, headY + 0.062, headRadius * 0.84);
  }

  return group;
}
