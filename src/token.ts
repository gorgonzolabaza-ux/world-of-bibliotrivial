import * as THREE from 'three';
import { CATEGORIES } from './categories';
import type { CategoryKey } from './categories';
import { createPlayerMesh, type Race } from './player';

export interface PlayerToken {
  group: THREE.Group;
  setRace(race: Race, color: string): void;
  setQuesito(category: CategoryKey, on: boolean): void;
  reset(): void;
  update(dt: number): void;
}

const BASE_RADIUS = 0.6;
const BASE_HEIGHT = 0.16;
const BED_Y = BASE_HEIGHT;
const WEDGE_HEIGHT = 0.062;
const FIGURE_SCALE = 1.0;

/** Sector circular plano (cuña) entre dos ángulos, para las porciones del quesito. */
function wedgeGeometry(inner: number, outer: number, fromDeg: number, toDeg: number, height: number) {
  const shape = new THREE.Shape();
  const a0 = THREE.MathUtils.degToRad(fromDeg);
  const a1 = THREE.MathUtils.degToRad(toDeg);
  shape.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
  shape.lineTo(Math.cos(a0) * outer, Math.sin(a0) * outer);
  shape.absarc(0, 0, outer, a0, a1, false);
  shape.lineTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
  shape.absarc(0, 0, inner, a1, a0, true);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Ficha del jugador: monigote sobre una peana cilíndrica con seis huecos
 * donde se van encajando las cuñas de quesito.
 */
export function createPlayerToken(race: Race, color: string): PlayerToken {
  const group = new THREE.Group();

  const bronze = new THREE.MeshStandardMaterial({ color: 0x8a6f4a, metalness: 0.55, roughness: 0.34 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(BASE_RADIUS * 0.97, BASE_RADIUS, BASE_HEIGHT, 40), bronze);
  base.position.y = BASE_HEIGHT / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b475, metalness: 0.78, roughness: 0.3 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(BASE_RADIUS * 0.93, 0.024, 6, 44), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BASE_HEIGHT - 0.012;
  group.add(rim);

  // bandeja oscura donde encajan las cuñas
  const bed = new THREE.Mesh(
    new THREE.CylinderGeometry(BASE_RADIUS * 0.86, BASE_RADIUS * 0.86, 0.03, 40),
    new THREE.MeshStandardMaterial({ color: 0x2a1f16, metalness: 0.2, roughness: 0.75 }),
  );
  bed.position.y = BED_Y + 0.005;
  bed.receiveShadow = true;
  group.add(bed);

  // seis cuñas de quesito (ocultas hasta que se ganan)
  const wedges: { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; value: number; target: number }[] = [];
  const span = 360 / CATEGORIES.length;
  CATEGORIES.forEach((category, i) => {
    const center = i * span + span / 2;
    const material = new THREE.MeshStandardMaterial({
      color: category.color,
      roughness: 0.3,
      metalness: 0.15,
      emissive: category.color,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(wedgeGeometry(BASE_RADIUS * 0.34, BASE_RADIUS * 0.82, center - 26, center + 26, WEDGE_HEIGHT), material);
    mesh.position.y = BED_Y + 0.018;
    mesh.scale.y = 0.001;
    mesh.visible = false;
    mesh.castShadow = true;
    group.add(mesh);
    wedges.push({ mesh, material, value: 0, target: 0 });
  });

  // el monigote
  let figure = createPlayerMesh(race, color);
  figure.scale.setScalar(FIGURE_SCALE);
  figure.position.y = BED_Y + 0.02;
  group.add(figure);

  return {
    group,
    setRace(newRace: Race, newColor: string) {
      group.remove(figure);
      figure = createPlayerMesh(newRace, newColor);
      figure.scale.setScalar(FIGURE_SCALE);
      figure.position.y = BED_Y + 0.02;
      group.add(figure);
    },
    setQuesito(category: CategoryKey, on: boolean) {
      const index = CATEGORIES.findIndex((c) => c.key === category);
      if (index >= 0) wedges[index].target = on ? 1 : 0;
    },
    reset() {
      for (const w of wedges) w.target = 0;
    },
    update(dt: number) {
      for (const w of wedges) {
        if (w.value === w.target) continue;
        const step = Math.min(1, dt * 6);
        w.value += (w.target - w.value) * step;
        if (Math.abs(w.target - w.value) < 0.005) w.value = w.target;
        const v = w.value;
        w.material.opacity = v;
        w.mesh.scale.y = 0.001 + v;
        w.mesh.visible = v > 0.01;
      }
    },
  };
}
