"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";

export interface ThreeHeroSceneProps {
  variant?: "hero" | "banner";
  className?: string;
}

export default function ThreeHeroScene({
  variant = "hero",
  className,
}: ThreeHeroSceneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [webglFallback, setWebglFallback] = useState(false);

  const sizeClass = variant === "banner" ? "h-32 sm:h-36" : "h-56 sm:h-64";

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      variant === "banner" ? 34 : 38,
      1,
      0.1,
      50,
    );
    camera.position.set(0, 0, variant === "banner" ? 5.6 : 5.2);

    // Éclairage
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    dirLight.position.set(4.5, 6, 5.5);
    scene.add(dirLight);

    const emeraldPoint = new THREE.PointLight(0x14b8a6, 1.5, 14);
    emeraldPoint.position.set(-3.5, -2.2, 4);
    scene.add(emeraldPoint);

    const goldPoint = new THREE.PointLight(0xf59e0b, 1.1, 12);
    goldPoint.position.set(3.2, 2.4, 3.5);
    scene.add(goldPoint);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Gélule 3D bicolore brillante
    const capsuleGroup = new THREE.Group();
    const radius = 0.54;
    const halfLength = 0.72;

    const emeraldMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b7e72,
      roughness: 0.2,
      metalness: 0.15,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
    });

    const ivoryMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffdf9,
      roughness: 0.2,
      metalness: 0.15,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.35,
      emissive: 0x78350f,
      emissiveIntensity: 0.15,
    });

    const topCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, halfLength, 36, 1, false),
      emeraldMat,
    );
    topCyl.position.y = halfLength / 2;
    capsuleGroup.add(topCyl);

    const topCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        radius,
        36,
        24,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
      emeraldMat,
    );
    topCap.position.y = halfLength;
    capsuleGroup.add(topCap);

    const bottomCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, halfLength, 36, 1, false),
      ivoryMat,
    );
    bottomCyl.position.y = -halfLength / 2;
    capsuleGroup.add(bottomCyl);

    const bottomCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        radius,
        36,
        24,
        0,
        Math.PI * 2,
        Math.PI / 2,
        Math.PI / 2,
      ),
      ivoryMat,
    );
    bottomCap.position.y = -halfLength;
    capsuleGroup.add(bottomCap);

    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.02, 0.042, 20, 48),
      goldMat,
    );
    goldRing.rotation.x = Math.PI / 2;
    capsuleGroup.add(goldRing);

    capsuleGroup.position.set(variant === "banner" ? -0.45 : -0.38, 0.05, 0);
    capsuleGroup.rotation.set(0.24, 0.18, -Math.PI / 4.6);
    rootGroup.add(capsuleGroup);

    // 2. Croix de pharmacie 3D lumineuse
    const crossGroup = new THREE.Group();
    const crossMat = new THREE.MeshPhysicalMaterial({
      color: 0x14b8a6,
      roughness: 0.2,
      metalness: 0.15,
      emissive: 0x0d9488,
      emissiveIntensity: 0.22,
      clearcoat: 0.65,
    });

    const verticalBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 1.06, 0.24),
      crossMat,
    );
    const horizontalBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.34, 0.24),
      crossMat,
    );
    const centerAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.38, 0.27),
      ivoryMat,
    );
    crossGroup.add(verticalBar, horizontalBar, centerAccent);
    crossGroup.position.set(variant === "banner" ? 1.25 : 1.18, 0.18, -0.15);
    crossGroup.rotation.set(0.12, -0.32, 0.08);
    rootGroup.add(crossGroup);

    // 3. Sphères moléculaires orbitales
    const orbitSpecs = [
      { radius: 0.15, dist: 1.72, angle: 0.4, y: 0.68, speed: 0.85, gold: false },
      { radius: 0.11, dist: 1.95, angle: 1.65, y: -0.62, speed: 1.05, gold: true },
      { radius: 0.13, dist: 1.55, angle: 2.85, y: 0.55, speed: 0.75, gold: false },
      { radius: 0.1, dist: 1.85, angle: 4.1, y: -0.48, speed: 0.95, gold: true },
      { radius: 0.12, dist: 1.48, angle: 5.25, y: 0.15, speed: 1.15, gold: false },
    ];

    const sphereGeometries = orbitSpecs.map(
      (spec) => new THREE.SphereGeometry(spec.radius, 24, 24),
    );
    const orbitMeshes = orbitSpecs.map((spec, index) => {
      const mesh = new THREE.Mesh(
        sphereGeometries[index],
        spec.gold ? goldMat : crossMat,
      );
      rootGroup.add(mesh);
      return { mesh, spec };
    });

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    updateSize();
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
      renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = mediaQuery.matches;
    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    mediaQuery.addEventListener?.("change", onMotionChange);

    let frameId = 0;
    const startTime = performance.now();
    let currentX = 0;
    let currentY = 0;

    const animate = (now: number) => {
      const elapsed = reducedMotion ? 0 : (now - startTime) * 0.001;

      currentX += (pointerRef.current.x - currentX) * 0.08;
      currentY += (pointerRef.current.y - currentY) * 0.08;

      rootGroup.rotation.y = currentX * 0.45 + Math.sin(elapsed * 0.5) * 0.12;
      rootGroup.rotation.x = -currentY * 0.3 + Math.cos(elapsed * 0.4) * 0.06;

      capsuleGroup.rotation.y = 0.18 + elapsed * 0.7;
      capsuleGroup.position.y = 0.05 + Math.sin(elapsed * 1.6) * 0.09;

      crossGroup.rotation.y = -0.32 - elapsed * 0.55;
      crossGroup.position.y = 0.18 + Math.cos(elapsed * 1.8) * 0.08;

      for (const { mesh, spec } of orbitMeshes) {
        const theta = spec.angle + elapsed * spec.speed;
        mesh.position.set(
          Math.cos(theta) * spec.dist,
          spec.y + Math.sin(elapsed * 1.4 + spec.angle) * 0.16,
          Math.sin(theta) * (spec.dist * 0.55),
        );
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mediaQuery.removeEventListener?.("change", onMotionChange);

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
        }
      });
      emeraldMat.dispose();
      ivoryMat.dispose();
      goldMat.dispose();
      crossMat.dispose();
      renderer.dispose();
    };
  }, [variant]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    pointerRef.current = {
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    };
  };

  const handlePointerLeave = () => {
    pointerRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label="Illustration 3D interactive de disponibilité pharmaceutique"
      role="img"
      className={[
        "relative w-full overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 select-none",
        sizeClass,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full bg-brand-500/25 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-sun-500/20 blur-2xl"
      />

      {webglFallback ? (
        <div className="flex h-full w-full items-center justify-center gap-4 px-4">
          <div className="flex h-14 w-28 -rotate-12 items-center overflow-hidden rounded-full border border-white/25 shadow-lg">
            <div className="h-full w-1/2 bg-brand-500" />
            <div className="h-full w-1/2 bg-sand" />
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/30 text-2xl font-bold text-brand-200">
            +
          </div>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-grab active:cursor-grabbing"
        />
      )}

      <div className="pointer-events-none absolute right-3 bottom-2.5 left-3 flex items-center justify-between text-[11px] font-medium text-brand-100/80">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Abidjan · Pharmacies en direct
        </span>
        <span className="hidden rounded-full bg-white/10 px-2 py-0.5 backdrop-blur-sm sm:inline">
          3D interactive
        </span>
      </div>
    </div>
  );
}
