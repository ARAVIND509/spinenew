import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AnalysisResults, ClinicalFinding } from '@shared/schema';

interface Spine3DModelProps {
    modelUrl: string;
    results?: AnalysisResults;
    visualMode?: 'standard' | 'perfusion' | 'signal' | 'neural';
}

/**
 * Spine3DModel V2
 * Optimized for high-fidelity medical visualization.
 * Auto-maps analysis results to specific anatomical components.
 */
const Spine3DModel: React.FC<Spine3DModelProps> = ({ modelUrl, results, visualMode }) => {
    const { scene } = useGLTF(modelUrl);
    const groupRef = useRef<THREE.Group>(null);

    // State Hooks
    const [meshesInitialized, setMeshesInitialized] = useState(false);
    const [defectMarkers, setDefectMarkers] = useState<{ position: [number, number, number], label: string, severity: string }[]>([]);
    const [lastMappingTime, setLastMappingTime] = useState(0);
    const [scanActive, setScanActive] = useState(true);
    // 1. Scene Processing & Material Setup
    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        console.log("[Spine3D] Initializing V2 Scene Model...");

        clone.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
                const mesh = node as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                // Ensure materials are unique for each component to prevent color bleed
                if (mesh.material instanceof THREE.MeshStandardMaterial) {
                    mesh.material = mesh.material.clone();
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    // Solid Professional Medical Aesthetic - HIGH VISIBILITY
                    mat.roughness = 0.4;
                    mat.metalness = 0.1;
                    mat.envMapIntensity = 1.0;
                    mat.transparent = true;
                    mat.opacity = 1.0;
                    mat.color.set('#ffffff');
                    mat.depthWrite = true;
                }
            }
        });
        return clone;
    }, [scene]);

    const availableMeshes = useMemo(() => {
        const names: string[] = [];
        clonedScene.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
                names.push(node.name);
            }
        });
        console.log("[Spine3D] Discovered meshes:", names);
        return names;
    }, [clonedScene]);

    const randomTarget = useMemo(() => {
        if (availableMeshes.length === 0) return '';
        // Prioritize vertebra-like names if possible
        const bones = availableMeshes.filter(n => {
            const low = n.toLowerCase();
            return low.includes('bone') || low.includes('vert') || /^[c-l]\d+$/i.test(n) || low.includes('sacrum') || low.includes('atlas');
        });
        const pool = bones.length > 0 ? bones : availableMeshes;
        const target = pool[Math.floor(Math.random() * pool.length)];
        console.log("[Spine3D] Selected random target for highlight:", target);
        return target;
    }, [availableMeshes, results]);

    // 2. Highlighting & Finding Mapping Logic
    useEffect(() => {
        if (!clonedScene) return;

        // Small delay to let Stage/transforms settle
        const mappingTimer = setTimeout(() => {
            const rawFindings = results?.findings || [];
            // Filter: keep findings unique by condition AND location (User Request)
            const filteredFindingsMap: Record<string, ClinicalFinding> = {};
            rawFindings.forEach(f => {
                const cond = (f.condition || '').toLowerCase().trim();
                const loc = (f.location || '').toLowerCase().trim();
                const key = `${cond}-${loc}`;
                const confidence = f.confidence || 0;

                if (!filteredFindingsMap[key] || confidence > (filteredFindingsMap[key].confidence || 0)) {
                    filteredFindingsMap[key] = f;
                }
            });
            const findings = Object.values(filteredFindingsMap);
            console.log("[Spine3D] Mapping unique findings:", findings.length, "(from raw:", rawFindings.length, ")");

            const newMarkers: { position: [number, number, number], label: string, severity: string }[] = [];
            const box = new THREE.Box3();
            const center = new THREE.Vector3();

            clonedScene.traverse((node) => {
                if ((node as THREE.Mesh).isMesh) {
                    const mesh = node as THREE.Mesh;
                    const material = mesh.material as THREE.MeshStandardMaterial;
                    const name = mesh.name.toLowerCase();

                    // Reset defect state
                    mesh.userData.isDefect = false;

                    // Base Anatomical Coloring (New Model specific)
                    const isVertebra = ['c3', 'c4', 'c5', 'c6', 'c7', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 'l1', 'l2', 'l3', 'l4', 'l5', 'atlas', 'axis', 'sacrum'].includes(name);
                    const isDiscGroup = ['cdisks', 'tdisks', 'ldisks'].includes(name);

                    if (isVertebra || name.includes('bones59') || name.includes('bone') || name.includes('vertebra')) {
                        material.color.set('#ffffff');
                        material.emissive.set('#000000');
                        material.emissiveIntensity = 0;
                        material.opacity = 1.0;
                        material.transparent = false;
                    } else if (isDiscGroup || name.includes('disc') || name.includes('vertebral_discs')) {
                        material.color.set('#a5f3fc'); // Lighter cyan for better visibility
                        material.transparent = true;
                        material.opacity = 0.9;
                        material.emissive.set('#0ea5e9');
                        material.emissiveIntensity = 0.1;
                    } else {
                        material.color.set('#ffffff');
                        material.transparent = false;
                        material.opacity = 1.0;
                    }

                    // HIGHLIGHTING LOGIC - ONLY PRIMARY FINDING (User Request)
                    let isHighlighted = false;
                    let highlightSeverity = 'normal';
                    let highlightCondition = '';

                    // Get semantic name by checking parents (Critical for multi-part meshes)
                    let semanticName = name;
                    let parent = mesh.parent;
                    while (parent && (semanticName === '' || semanticName.includes('object') || semanticName.includes('3dsmesh'))) {
                        if (parent.name && !parent.name.toLowerCase().includes('object') && !parent.name.toLowerCase().includes('3dsmesh')) {
                            semanticName = parent.name.toLowerCase();
                            break;
                        }
                        parent = parent.parent;
                    }

                    const primaryFinding = results?.primaryFinding;
                    const heatmapTargets = results?.heatmapTargets || [];

                    // 1. Check Heatmap Targets (High Precision)
                    const heatmapMatch = heatmapTargets.find(ht =>
                        name === ht.region.toLowerCase() ||
                        name.includes(ht.region.toLowerCase()) ||
                        semanticName === ht.region.toLowerCase() ||
                        semanticName.includes(ht.region.toLowerCase())
                    );

                    if (heatmapMatch) {
                        isHighlighted = true;
                        highlightSeverity = heatmapMatch.severity || 'severe';
                        highlightCondition = heatmapMatch.condition;
                    }
                    // 2. Fallback to Primary Finding (Anatomical Level matching)
                    else if (primaryFinding) {
                        const loc = (primaryFinding.location || '').toLowerCase();
                        const severity = (primaryFinding.severity || '').toLowerCase();
                        const condition = (primaryFinding.condition || '').toLowerCase();

                        // Anatomical Level matching
                        const levels = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 'l1', 'l2', 'l3', 'l4', 'l5', 's1'];
                        const locLevels = levels.filter(lvl => loc.includes(lvl));

                        if (loc.includes('atlas')) locLevels.push('atlas');
                        if (loc.includes('axis')) locLevels.push('axis');
                        if (loc.includes('sacrum') || loc.includes('s1')) locLevels.push('sacrum');

                        const isSpecificLevelMatch = locLevels.some(lvl =>
                            name === lvl || name.includes(lvl) ||
                            semanticName === lvl || semanticName.includes(lvl)
                        );

                        const isSpineCurvature = loc.includes('spine') || loc.includes('posture') || condition.includes('scoliosis');

                        let match = false;
                        if (isSpecificLevelMatch) {
                            match = true;
                        } else if (isSpineCurvature && (isVertebra || name.includes('bone') || semanticName.includes('bone'))) {
                            const isCervical = loc.includes('cervical') || loc.includes(' c') || loc.includes('(c');
                            const isThoracic = loc.includes('thoracic') || loc.includes(' t') || loc.includes('(t');
                            const isLumbar = loc.includes('lumbar') || loc.includes(' l') || loc.includes('(l');

                            if (isCervical && (name.startsWith('c') || name === 'atlas' || name === 'axis')) match = true;
                            else if (isThoracic && name.startsWith('t')) match = true;
                            else if (isLumbar && (name.startsWith('l') || name === 'sacrum')) match = true;
                            else if (!isCervical && !isThoracic && !isLumbar && isVertebra) match = true;
                        }

                        if (match && severity !== 'normal') {
                            isHighlighted = true;
                            highlightSeverity = severity;
                            highlightCondition = condition;
                        }
                    }

                    // Step C: Apply Highlighting & Markers
                    if (isHighlighted) {
                        // Keep defect flag for localized animations
                        mesh.userData.isDefect = true;

                        mesh.updateMatrixWorld(true);
                        box.setFromObject(mesh);
                        box.getCenter(center);
                        if (groupRef.current) groupRef.current.worldToLocal(center);

                        // Prevent duplicate markers for the same condition at the exact same point
                        const isDuplicate = newMarkers.some(m =>
                            m.label === highlightCondition.toUpperCase() &&
                            Math.abs(m.position[0] - center.x) < 0.1 &&
                            Math.abs(m.position[1] - center.y) < 0.1 &&
                            Math.abs(m.position[2] - center.z) < 0.1
                        );

                        if (!isDuplicate) {
                            newMarkers.push({
                                position: [center.x, center.y, center.z],
                                label: highlightCondition.toUpperCase(),
                                severity: highlightSeverity
                            });
                        }
                    }

                    // Mode Overrides - Removed global glow for 'neural' mode
                    // Only defects should glow
                }
            });

            setDefectMarkers(newMarkers);
            setMeshesInitialized(true);
        }, 500);

        return () => clearTimeout(mappingTimer);
    }, [clonedScene, results, visualMode]);

    // 3. Dynamic Animations (Pulse & Breathing)
    useFrame((state) => {
        if (!groupRef.current) return;
        const time = state.clock.getElapsedTime();

        // Core Breathing
        groupRef.current.position.y = Math.sin(time * 0.8) * 0.05;

        // Defect Localized Glow Simulation
        clonedScene.traverse((node) => {
            if ((node as THREE.Mesh).isMesh && node.userData.isDefect) {
                // Subtle breathing for the anatomical part (no color change)
                const pulse = (Math.sin(time * 6) + 1) / 2;
                node.scale.setScalar(1 + pulse * 0.01);
            }
        });
    });

    return (
        <group ref={groupRef}>
            <primitive object={clonedScene} />

            {defectMarkers.map((marker, idx) => (
                <group key={`defect-${idx}`} position={marker.position}>
                    {/* Volumetric Glow Orb (Localized Clinical Focus) */}
                    <mesh>
                        <sphereGeometry args={[0.3, 32, 32]} />
                        <meshStandardMaterial
                            color="#ff0000"
                            emissive="#ff0000"
                            emissiveIntensity={15}
                            transparent={true}
                            opacity={0.6}
                            depthWrite={false}
                        />
                    </mesh>

                    {/* Outer Halo Glow */}
                    <mesh>
                        <sphereGeometry args={[0.6, 32, 32]} />
                        <meshStandardMaterial
                            color="#ff0000"
                            emissive="#ff0000"
                            emissiveIntensity={5}
                            transparent={true}
                            opacity={0.2}
                            depthWrite={false}
                        />
                    </mesh>

                    {/* Precise Point Light - Local Wash Only */}
                    <pointLight
                        intensity={15}
                        distance={3}
                        decay={2}
                        color="#ff0000"
                    />
                </group>
            ))}

            {/* Floating Clinical Labels with Hotspot Dot */}
            {defectMarkers.map((marker, idx) => (
                <Html key={idx} position={marker.position} distanceFactor={8} center>
                    <div className="flex flex-col items-center pointer-events-none select-none">
                        {/* The Hovering Label */}
                        <div className="px-5 py-2.5 bg-black/60 backdrop-blur-2xl border border-red-500/50 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.3)] animate-in zoom-in duration-500 mb-4 transition-transform hover:scale-105">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Clinical Observation</span>
                            </div>
                            <div className="text-xs font-bold text-white whitespace-nowrap">{marker.label}</div>
                        </div>

                        {/* Visual Connection Line */}
                        <div className="w-[1px] h-10 bg-gradient-to-t from-red-600/80 via-red-600/20 to-transparent" />

                        {/* Anchor Hotspot Dot - THIS IS WHAT CLARIFIES THE EXACT SPOT */}
                        <div className="relative flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-red-600/40 animate-ping absolute" />
                            <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_15px_#ff0000]" />
                        </div>
                    </div>
                </Html>
            ))}

            <mesh position={[0, 0, 0]} visible={false}>
                <sphereGeometry args={[0.05]} />
                <meshBasicMaterial color="red" />
            </mesh>
        </group>
    );
};

export default Spine3DModel;
