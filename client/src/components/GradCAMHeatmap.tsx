import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Info, MapPin } from "lucide-react";
import type { GradCAMHeatmap as GradCAMHeatmapType } from "@shared/schema";

interface GradCAMHeatmapProps {
  heatmaps: GradCAMHeatmapType[];
}

export function GradCAMHeatmap({ heatmaps }: GradCAMHeatmapProps) {
  if (!heatmaps || heatmaps.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Grad-CAM Visual Interpretability</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Highlights regions that influenced AI predictions for medical validation
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={heatmaps[0].condition} className="w-full">
          <TabsList className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(heatmaps.length, 3)}, 1fr)` }}>
            {heatmaps.map((heatmap) => (
              <TabsTrigger
                key={heatmap.condition}
                value={heatmap.condition}
                className="text-xs"
                data-testid={`tab-${heatmap.condition.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {heatmap.condition}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {heatmaps.map((heatmap) => (
            <TabsContent key={heatmap.condition} value={heatmap.condition} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        Heatmap
                      </Badge>
                    </div>
                    <div className="relative rounded-md overflow-hidden border bg-muted/20">
                      <img
                        src={heatmap.heatmapImageUrl}
                        alt={`Heatmap for ${heatmap.condition}`}
                        className="w-full h-auto"
                        data-testid={`img-heatmap-${heatmap.condition.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <div className="flex-1 h-3 rounded-full" style={{
                        background: 'linear-gradient(to right, #000080, #0000ff, #00ffff, #00ff00, #ffff00, #ff7f00, #ff0000, #800000)'
                      }} />
                      <span>Low</span>
                      <span>→</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        Overlay
                      </Badge>
                    </div>
                    <div className="relative rounded-md overflow-hidden border bg-muted/20">
                      <img
                        src={heatmap.overlayImageUrl}
                        alt={`Overlay for ${heatmap.condition}`}
                        className="w-full h-auto"
                        data-testid={`img-overlay-${heatmap.condition.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Original scan with heatmap overlay showing AI focus areas
                    </p>
                  </div>
                </div>
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-2">AI Interpretation</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {heatmap.interpretationNotes}
                      </p>
                    </div>
                  </div>

                  {heatmap.affectedRegions.length > 0 && (
                    <div className="border-t border-primary/20 pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">Detected Affected Regions</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {heatmap.affectedRegions.map((region, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-md bg-background/50 border border-primary/10"
                            data-testid={`region-${region.region.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{region.region}</p>
                              <p className="text-xs text-muted-foreground">
                                Activation: {Math.round(region.intensity * 100)}%
                              </p>
                            </div>
                            <div className="ml-2">
                              <div
                                className="h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                                style={{
                                  borderColor: region.intensity > 0.7 ? '#ef4444' : region.intensity > 0.5 ? '#f97316' : '#eab308',
                                  backgroundColor: `rgba(${region.intensity > 0.7 ? '239, 68, 68' : region.intensity > 0.5 ? '249, 115, 22' : '234, 179, 8'}, 0.1)`,
                                  color: region.intensity > 0.7 ? '#ef4444' : region.intensity > 0.5 ? '#f97316' : '#eab308',
                                }}
                              >
                                {Math.round(region.intensity * 100)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
