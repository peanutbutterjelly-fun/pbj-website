// A small photo studio to reflect: a dim room with a few bright soft-boxes. Glossy paper catches them as streaks of shine.
// Shared by the magazine and the hosts grid so every cover and page shines the same way.
import * as THREE from "three";

export function makeStudio(renderer) {
  const studio = new THREE.Scene();
  studio.add(new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: 0x8a8a8a, side: THREE.BackSide })));
  for (const [x, y, z, w, h, power] of [[-9, 2, 6, 2.5, 14, 6], [10, 4, 4, 1.5, 14, 4], [0, 12, 3, 16, 2, 5], [3, -6, 9, 10, 1, 2.5]]) {
    const box = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(power, power, power), side: THREE.DoubleSide }));
    box.position.set(x, y, z);
    box.lookAt(0, 0, 0);
    studio.add(box);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(studio, 0.02).texture;
  return { texture, dispose: () => pmrem.dispose() };
}

// The paper itself: neutral, glossy, double-sided
export const paperMaterial = (stiff = false) =>
  new THREE.MeshPhysicalMaterial({ color: 0xf0f0f0, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, envMapIntensity: stiff ? 1.5 : 1.3 });
