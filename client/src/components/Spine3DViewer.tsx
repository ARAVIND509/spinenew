import React, { Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalysisResults, ClinicalFinding } from '@shared/schema';
import { Box, Activity, Zap, Maximize2, RotateCcw, Crosshair } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Float, Html, Stage } from '@react-three/drei';
import Spine3DModel from './Spine3DModel';

interface Spine3DViewerProps {
    results?: AnalysisResults;
    imageUrl?: string;
    visualMode?: 'standard' | 'perfusion' | 'signal' | 'neural';
    isFullView?: boolean;
}

const Spine3DViewer: React.FC<Spine3DViewerProps> = ({ results, visualMode = 'standard', isFullView = false }) => {
    const [isLoading, setIsLoading] = useState(true);
    const viewerSevereFindings = React.useMemo(() => {
        if (!results?.findings) return [];

        // Final aggressive deduplication for HUD display
        // We group by condition and major section (C, T, L)
        const grouped = results.findings
            .filter((f: ClinicalFinding) => f.severity === 'severe')
            .reduce((acc: Record<string, ClinicalFinding>, f) => {
                const cond = f.condition.trim().toLowerCase();
                const loc = (f.location || '').toLowerCase();

                // Determine major section
                let section = 'other';
                if (loc.includes('c') || loc.includes('cervical')) section = 'cervical';
                else if (loc.includes('t') || loc.includes('thoracic')) section = 'thoracic';
                else if (loc.includes('l') || loc.includes('lumbar')) section = 'lumbar';

                const key = `${cond}-${section}`;
                if (!acc[key]) {
                    acc[key] = { ...f, location: section.toUpperCase() };
                }
                return acc;
            }, {});

        return Object.values(grouped);
    }, [results]);

    useEffect(() => {
        if (results) setIsLoading(false);
    }, [results]);

    return (
        <div className="relative w-full h-full bg-[#020617] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group">
            {/* UI HUD Overlays */}
            <div className="absolute top-6 left-6 z-20 pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <Box className="w-4 h-4 text-blue-400 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-blue-100 uppercase tracking-widest leading-none">Anatomical Reconstruction</h3>
                        <p className="text-[8px] text-blue-400 font-mono mt-1 tracking-tighter uppercase">Source: voxel_data_alpha_7</p>
                    </div>
                </div>
            </div>

            <div className="absolute top-6 right-6 z-20 flex gap-2">
                <div className="px-3 py-1 bg-black/60 backdrop-blur-xl border border-blue-500/20 rounded-full text-[9px] text-blue-400 font-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-[pulse_1s_infinite] shadow-[0_0_8px_#3b82f6]" />
                    ACTIVE_NEURAL_SCAN
                </div>
            </div>

            {/* 3D Scene */}
            <div className="w-full h-full">
                <Canvas
                    shadows
                    dpr={[1, 2]}
                    gl={{ antialias: true, alpha: true }}
                >
                    <color attach="background" args={['#020617']} />

                    <Suspense fallback={
                        <Html center>
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                <span className="text-[10px] font-mono text-primary uppercase tracking-[0.3em]">Downloading_Voxels</span>
                            </div>
                        </Html>
                    }>
                        {/* Stage handles professional lighting and centering automatically */}
                        <Stage
                            intensity={1.2}
                            environment="city"
                            adjustCamera={2.0}
                            shadows={false}
                            center={{ precise: true }}
                        >
                            <Float speed={2} rotationIntensity={0.3} floatIntensity={0.3}>
                                <Spine3DModel
                                    modelUrl="/models/spine.glb"
                                    results={results}
                                    visualMode={visualMode}
                                />
                            </Float>
                        </Stage>

                        {/* High-Contrast Clinical Lighting */}
                        <ambientLight intensity={0.4} />
                        <pointLight position={[10, 20, 10]} intensity={4} color="#ffffff" />
                        <pointLight position={[-10, 10, -10]} intensity={2} color="#ffffff" />
                        <spotLight position={[0, 40, 0]} angle={0.25} penumbra={1} intensity={12} color="#ffffff" castShadow />

                        <Environment preset="night" />
                    </Suspense>

                    <OrbitControls
                        enablePan={false}
                        enableZoom={true}
                        minDistance={2}
                        maxDistance={15}
                        autoRotate={true}
                        autoRotateSpeed={0.5}
                        makeDefault
                    />
                </Canvas>
            </div>

            {/* Bottom HUD - Only visible in full view */}
            {isFullView && (
                <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-5 rounded-[2rem] shadow-2xl space-y-3 min-w-[200px]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <Zap className="w-4 h-4 text-blue-500 animate-pulse" />
                            </div>
                            <span className="text-[11px] font-black text-white/90 uppercase tracking-widest">Diagnostic Summary</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {results?.primaryFinding ? (
                                <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl border border-primary/20 transition-all">
                                    <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary),1)] ${results.primaryFinding.severity === 'severe' ? 'bg-red-500' :
                                            results.primaryFinding.severity === 'moderate' ? 'bg-orange-500' : 'bg-emerald-500'
                                        }`} />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-white uppercase leading-none">{results.primaryFinding.condition}</span>
                                        <span className="text-[8px] font-mono text-white/40 uppercase mt-1">CONF: {results.primaryFinding.confidence}% | {results.primaryFinding.severity}</span>
                                    </div>
                                </div>
                            ) : results ? (
                                <div className="flex items-center gap-3 p-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-mono text-emerald-400 capitalize">Normal structural integrity</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-white/30 animate-spin" />
                                    <span className="text-[10px] font-mono text-white/20 uppercase">Acquiring signal...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute bottom-6 right-6 z-20">
                <div className="text-[8px] font-mono text-white/20 text-right">
                    <p>ENGINE: THREE.JS_R154</p>
                    <p>SHADER: PBR_METALLIC_ROUGHNESS</p>
                </div>
            </div>

            {/* Loading Mask */}
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40 bg-[#020617] flex items-center justify-center"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <Activity className="h-8 w-8 text-blue-500 animate-pulse" />
                            <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-blue-500"
                                    animate={{ width: ["0%", "100%"] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            </div>
                            <span className="text-[9px] font-mono text-blue-400 tracking-[0.4em] uppercase">Booting_Visualizer</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default Spine3DViewer;
