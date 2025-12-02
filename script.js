/**
 * Light Refraction Experience - Prismatic Dispersion Edition
 *
 * Architecture:
 * 1. Glass Blocks: Generate dense field of 3D-like polygonal glass volumes with iridescence
 * 2. Light Bar: Interactive horizontal bar at bottom for angle control
 * 3. Ray Casting: Emit beams from bar, trace through glass blocks
 * 4. Chromatic Dispersion: Split light into spectral wavelengths with different refraction
 * 5. Rendering: Draw glass blocks, prismatic beams with bloom, smooth transitions
 */

// ============================================================================
// GLOBAL STATE AND CONFIGURATION
// ============================================================================

const canvas = document.getElementById('refractionCanvas');
const ctx = canvas.getContext('2d');
const angleDisplay = document.getElementById('angleValue');

// Canvas dimensions
let canvasWidth = 0;
let canvasHeight = 0;

// Spectral wavelength configuration for chromatic dispersion
// Each wavelength has a unique color and refractive index
const WAVELENGTHS = [
    { name: 'red',     color: 'rgb(255, 50, 50)',    eta: 1.514, weight: 1.0 },
    { name: 'orange',  color: 'rgb(255, 140, 0)',    eta: 1.517, weight: 0.9 },
    { name: 'yellow',  color: 'rgb(255, 230, 0)',    eta: 1.520, weight: 0.8 },
    { name: 'green',   color: 'rgb(50, 255, 100)',   eta: 1.522, weight: 0.9 },
    { name: 'cyan',    color: 'rgb(0, 200, 255)',    eta: 1.524, weight: 0.85 },
    { name: 'blue',    color: 'rgb(50, 100, 255)',   eta: 1.527, weight: 0.9 },
    { name: 'violet',  color: 'rgb(180, 50, 255)',   eta: 1.530, weight: 0.8 }
];

// Glass blocks configuration - OPTIMIZED for performance
const GLASS_BLOCK_COUNT = 45; // Reduced for better performance while maintaining visual richness
const glassBlocks = [];

// Light bar configuration
const lightBar = {
    x: 0,           // Center X position
    y: 0,           // Y position (near bottom)
    width: 200,     // Bar width
    height: 8,      // Bar height
    angle: 90,      // Emission angle in degrees (90 = straight up)
    targetAngle: 90,
    angleVelocity: 0
};

// Interaction state
let isDragging = false;
let dragStartX = 0;
let dragStartAngle = 0;

// Beam paths (computed from ray tracing) - now includes wavelength information
let currentBeams = [];
let previousBeams = [];
let beamTransition = 1.0; // 0 = previous, 1 = current

// Animation time
let animationTime = 0;

// Performance optimization - CRITICAL for 60fps
const MAX_BOUNCES = 3; // Reduced from 6 - prevents exponential explosion of beams
const RAY_COUNT = 4;   // Reduced from 5 - 4 rays × 7 wavelengths = 28 initial dispersed beams

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    resizeCanvas();
    generateGlassBlocks();
    computeBeams();
    animate(0);
}

function resizeCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Position light bar at bottom center
    lightBar.x = canvasWidth / 2;
    lightBar.y = canvasHeight - 100;
}

window.addEventListener('resize', () => {
    resizeCanvas();
    generateGlassBlocks();
    computeBeams();
});

// ============================================================================
// GLASS BLOCK GENERATION
// ============================================================================

/**
 * Generate a dense field of 3D-like glass blocks in the top half
 * Each block is an irregular polygon with depth information
 */
function generateGlassBlocks() {
    glassBlocks.length = 0;

    for (let i = 0; i < GLASS_BLOCK_COUNT; i++) {
        // Position in top 60% of screen
        const x = Math.random() * canvasWidth;
        const y = Math.random() * canvasHeight * 0.6;

        // Size based on depth (larger = closer)
        const depth = Math.random();
        const size = 30 + depth * 80;

        // Generate irregular polygon (4-7 sides)
        const sides = Math.floor(Math.random() * 4) + 4;
        const vertices = [];
        const angleStep = (Math.PI * 2) / sides;

        for (let j = 0; j < sides; j++) {
            const angle = angleStep * j + Math.random() * 0.3;
            const radius = size * (0.7 + Math.random() * 0.3);
            vertices.push({
                x: x + Math.cos(angle) * radius,
                y: y + Math.sin(angle) * radius
            });
        }

        // Opacity and blur based on depth
        const opacity = 0.15 + depth * 0.25;
        const blur = (1 - depth) * 3;

        glassBlocks.push({
            x,
            y,
            size,
            vertices,
            depth,
            opacity,
            blur,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.001,
            pulseOffset: Math.random() * Math.PI * 2
        });
    }

    // Sort by depth (furthest first for proper rendering)
    glassBlocks.sort((a, b) => a.depth - b.depth);
}

/**
 * Calculate the center point of a polygon
 */
function getPolygonCenter(vertices) {
    let sumX = 0, sumY = 0;
    for (const v of vertices) {
        sumX += v.x;
        sumY += v.y;
    }
    return { x: sumX / vertices.length, y: sumY / vertices.length };
}

/**
 * Check if a point is inside a polygon
 */
function pointInPolygon(x, y, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Find intersection point between line segment and polygon edge
 */
function lineSegmentIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1),
            t: t
        };
    }
    return null;
}

/**
 * Find where a ray intersects a glass block
 */
function findRayIntersection(rayStart, rayDir, block) {
    const vertices = block.vertices;
    let closestIntersection = null;
    let closestDistance = Infinity;
    let intersectionEdge = null;

    // Check intersection with each edge
    for (let i = 0; i < vertices.length; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % vertices.length];

        // Cast ray far into the scene
        const rayEnd = {
            x: rayStart.x + rayDir.x * 10000,
            y: rayStart.y + rayDir.y * 10000
        };

        const intersection = lineSegmentIntersection(
            rayStart.x, rayStart.y,
            rayEnd.x, rayEnd.y,
            v1.x, v1.y,
            v2.x, v2.y
        );

        if (intersection) {
            const dist = Math.hypot(
                intersection.x - rayStart.x,
                intersection.y - rayStart.y
            );

            if (dist < closestDistance && dist > 0.1) {
                closestDistance = dist;
                closestIntersection = intersection;
                intersectionEdge = { v1, v2, index: i };
            }
        }
    }

    if (closestIntersection && intersectionEdge) {
        // Calculate edge normal
        const edgeX = intersectionEdge.v2.x - intersectionEdge.v1.x;
        const edgeY = intersectionEdge.v2.y - intersectionEdge.v1.y;
        const edgeLength = Math.hypot(edgeX, edgeY);

        // Normal perpendicular to edge (pointing inward)
        let normalX = -edgeY / edgeLength;
        let normalY = edgeX / edgeLength;

        // Ensure normal points toward polygon center
        const center = getPolygonCenter(vertices);
        const toCenter = {
            x: center.x - closestIntersection.x,
            y: center.y - closestIntersection.y
        };

        if (normalX * toCenter.x + normalY * toCenter.y < 0) {
            normalX = -normalX;
            normalY = -normalY;
        }

        return {
            point: closestIntersection,
            normal: { x: normalX, y: normalY },
            distance: closestDistance
        };
    }

    return null;
}

// ============================================================================
// RAY TRACING AND REFRACTION
// ============================================================================

/**
 * Compute refracted ray direction using Snell's law with wavelength-specific refractive index
 * Different wavelengths refract at different angles, creating chromatic dispersion
 */
function refractRay(incident, normal, entering, wavelengthEta) {
    // Chromatic dispersion: use wavelength-specific refractive index
    const incidentDot = incident.x * normal.x + incident.y * normal.y;

    // Use wavelength-specific eta for dispersion
    const eta = entering ? 1.0 / wavelengthEta : wavelengthEta / 1.0;

    const k = 1 - eta * eta * (1 - incidentDot * incidentDot);

    if (k < 0) {
        // Total internal reflection
        return {
            x: incident.x - 2 * incidentDot * normal.x,
            y: incident.y - 2 * incidentDot * normal.y
        };
    }

    // Refracted direction
    const refracted = {
        x: eta * incident.x + (eta * incidentDot - Math.sqrt(k)) * normal.x,
        y: eta * incident.y + (eta * incidentDot - Math.sqrt(k)) * normal.y
    };

    // Normalize
    const length = Math.hypot(refracted.x, refracted.y);
    return {
        x: refracted.x / length,
        y: refracted.y / length
    };
}

/**
 * Trace a single ray through the glass field
 * White beams split into spectral wavelengths when hitting glass (chromatic dispersion)
 */
function traceRay(startX, startY, dirX, dirY, wavelength, depth = 0) {
    if (depth >= MAX_BOUNCES) return [];

    const segments = [];
    const rayStart = { x: startX, y: startY };
    const rayDir = { x: dirX, y: dirY };
    const isWhiteBeam = (wavelength === null); // White beam until first glass hit

    // Find closest intersection with any glass block
    let closestBlock = null;
    let closestIntersection = null;
    let closestDistance = Infinity;

    for (const block of glassBlocks) {
        const intersection = findRayIntersection(rayStart, rayDir, block);
        if (intersection && intersection.distance < closestDistance) {
            closestDistance = intersection.distance;
            closestIntersection = intersection;
            closestBlock = block;
        }
    }

    if (closestIntersection && closestBlock) {
        if (isWhiteBeam) {
            // WHITE BEAM hits glass - add white segment up to intersection
            segments.push({
                x1: rayStart.x,
                y1: rayStart.y,
                x2: closestIntersection.point.x,
                y2: closestIntersection.point.y,
                intensity: 1.0 / (depth + 1),
                wavelength: null, // null = white beam
                isWhite: true
            });

            // CHROMATIC DISPERSION: Split into all wavelengths at glass entry
            for (const wl of WAVELENGTHS) {
                // Each wavelength refracts at different angle
                const refractedDir = refractRay(
                    rayDir,
                    closestIntersection.normal,
                    true,
                    wl.eta
                );

                // Find exit point for this wavelength
                const exitIntersection = findRayIntersection(
                    { x: closestIntersection.point.x + refractedDir.x * 0.1, y: closestIntersection.point.y + refractedDir.y * 0.1 },
                    refractedDir,
                    closestBlock
                );

                if (exitIntersection) {
                    // Segment inside glass with spectral color
                    segments.push({
                        x1: closestIntersection.point.x,
                        y1: closestIntersection.point.y,
                        x2: exitIntersection.point.x,
                        y2: exitIntersection.point.y,
                        intensity: 0.7 / (depth + 1),
                        insideGlass: true,
                        wavelength: wl
                    });

                    // Refract again when exiting
                    const exitDir = refractRay(
                        refractedDir,
                        { x: -exitIntersection.normal.x, y: -exitIntersection.normal.y },
                        false,
                        wl.eta
                    );

                    // Continue tracing this wavelength
                    const furtherSegments = traceRay(
                        exitIntersection.point.x,
                        exitIntersection.point.y,
                        exitDir.x,
                        exitDir.y,
                        wl,
                        depth + 1
                    );

                    segments.push(...furtherSegments);
                }
            }
        } else {
            // COLORED BEAM (already dispersed) - continue with single wavelength
            segments.push({
                x1: rayStart.x,
                y1: rayStart.y,
                x2: closestIntersection.point.x,
                y2: closestIntersection.point.y,
                intensity: 1.0 / (depth + 1),
                wavelength: wavelength
            });

            // Compute refracted direction with wavelength-specific refraction
            const refractedDir = refractRay(
                rayDir,
                closestIntersection.normal,
                true,
                wavelength.eta
            );

            // Find exit point
            const exitIntersection = findRayIntersection(
                { x: closestIntersection.point.x + refractedDir.x * 0.1, y: closestIntersection.point.y + refractedDir.y * 0.1 },
                refractedDir,
                closestBlock
            );

            if (exitIntersection) {
                // Segment inside glass
                segments.push({
                    x1: closestIntersection.point.x,
                    y1: closestIntersection.point.y,
                    x2: exitIntersection.point.x,
                    y2: exitIntersection.point.y,
                    intensity: 0.7 / (depth + 1),
                    insideGlass: true,
                    wavelength: wavelength
                });

                // Refract again when exiting
                const exitDir = refractRay(
                    refractedDir,
                    { x: -exitIntersection.normal.x, y: -exitIntersection.normal.y },
                    false,
                    wavelength.eta
                );

                // Continue tracing
                const furtherSegments = traceRay(
                    exitIntersection.point.x,
                    exitIntersection.point.y,
                    exitDir.x,
                    exitDir.y,
                    wavelength,
                    depth + 1
                );

                segments.push(...furtherSegments);
            }
        }
    } else {
        // No intersection - ray goes to top of screen
        const endY = 0;
        const t = (endY - rayStart.y) / rayDir.y;
        const endX = rayStart.x + rayDir.x * t;

        if (t > 0) {
            segments.push({
                x1: rayStart.x,
                y1: rayStart.y,
                x2: endX,
                y2: endY,
                intensity: 1.0 / (depth + 1),
                wavelength: wavelength,
                isWhite: isWhiteBeam
            });
        }
    }

    return segments;
}

/**
 * Compute all beam paths from the light bar at current angle
 * Emits WHITE beams that split into spectrum when hitting glass
 */
function computeBeams() {
    const beams = [];
    const angleRad = lightBar.angle * (Math.PI / 180);

    // Cast multiple WHITE rays with slight angle variations
    for (let i = 0; i < RAY_COUNT; i++) {
        const spreadAngle = ((i - RAY_COUNT / 2) / RAY_COUNT) * 20 * (Math.PI / 180);
        const rayAngle = angleRad + spreadAngle;

        const dirX = Math.cos(rayAngle);
        const dirY = -Math.sin(rayAngle);

        const startX = lightBar.x + ((i - RAY_COUNT / 2) / RAY_COUNT) * lightBar.width * 0.8;
        const startY = lightBar.y;

        // Trace WHITE beam (wavelength = null)
        // It will split into spectrum when it hits glass
        const segments = traceRay(
            startX,
            startY,
            dirX,
            dirY,
            null  // null = white beam, disperses at first glass intersection
        );

        beams.push(...segments);
    }

    return beams;
}

/**
 * Update beam paths when angle changes
 */
function updateBeams() {
    // Store previous beams for smooth transition
    previousBeams = [...currentBeams];
    currentBeams = computeBeams();
    beamTransition = 0; // Start transition
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Draw a single glass block with 3D effect and iridescent color refraction
 */
function drawGlassBlock(block, time) {
    const { vertices, opacity, blur, depth, pulseOffset } = block;

    // Subtle pulsing opacity
    const pulseOpacity = opacity * (0.9 + 0.1 * Math.sin(time * 0.5 + pulseOffset));

    ctx.save();

    // Apply blur for depth effect
    if (blur > 0) {
        ctx.filter = `blur(${blur}px)`;
    }

    // Draw filled polygon
    ctx.beginPath();
    for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
    }
    ctx.closePath();

    // Fill with iridescent gradient (subtle spectral colors)
    const center = getPolygonCenter(vertices);
    const gradient = ctx.createRadialGradient(
        center.x, center.y, 0,
        center.x, center.y, block.size
    );

    // Create iridescent effect with subtle color shifts
    const hueShift = (time * 10 + block.x * 0.1 + block.y * 0.1) % 360;
    const iridescence = 0.15; // Subtle color amount

    gradient.addColorStop(0, `hsla(${hueShift}, 70%, 85%, ${pulseOpacity * 0.25})`);
    gradient.addColorStop(0.4, `hsla(${(hueShift + 60) % 360}, 60%, 80%, ${pulseOpacity * 0.15})`);
    gradient.addColorStop(0.7, `hsla(${(hueShift + 120) % 360}, 50%, 75%, ${pulseOpacity * 0.1})`);
    gradient.addColorStop(1, `rgba(255, 255, 255, ${pulseOpacity * 0.02})`);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw edge outline with spectral highlights
    // Each edge gets a subtle rainbow shimmer
    for (let i = 0; i < vertices.length; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % vertices.length];

        // Edge-specific hue based on position
        const edgeHue = (hueShift + i * (360 / vertices.length)) % 360;

        const edgeGradient = ctx.createLinearGradient(v1.x, v1.y, v2.x, v2.y);
        edgeGradient.addColorStop(0, `hsla(${edgeHue}, 80%, 70%, ${pulseOpacity * 0.4})`);
        edgeGradient.addColorStop(0.5, `hsla(${(edgeHue + 30) % 360}, 80%, 75%, ${pulseOpacity * 0.6})`);
        edgeGradient.addColorStop(1, `hsla(${(edgeHue + 60) % 360}, 80%, 70%, ${pulseOpacity * 0.4})`);

        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.strokeStyle = edgeGradient;
        ctx.lineWidth = 1 + depth * 1.5;
        ctx.stroke();
    }

    // Inner prismatic highlight
    ctx.beginPath();
    const highlightOffset = block.size * 0.15;
    for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        const toCenter = { x: center.x - v.x, y: center.y - v.y };
        const length = Math.hypot(toCenter.x, toCenter.y);

        if (length > 0) {
            const offsetX = (toCenter.x / length) * highlightOffset;
            const offsetY = (toCenter.y / length) * highlightOffset;

            if (i === 0) ctx.moveTo(v.x + offsetX, v.y + offsetY);
            else ctx.lineTo(v.x + offsetX, v.y + offsetY);
        }
    }
    ctx.closePath();

    // Iridescent inner glow
    const innerHue = (hueShift + 180) % 360;
    ctx.strokeStyle = `hsla(${innerHue}, 70%, 80%, ${pulseOpacity * 0.35})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Add subtle spectral sparkle points
    if (depth > 0.5) { // Only on closer blocks
        const sparkleCount = 2;
        for (let i = 0; i < sparkleCount; i++) {
            const sparkleX = center.x + (Math.random() - 0.5) * block.size * 0.4;
            const sparkleY = center.y + (Math.random() - 0.5) * block.size * 0.4;
            const sparkleHue = (hueShift + Math.random() * 120) % 360;

            ctx.beginPath();
            ctx.arc(sparkleX, sparkleY, 1 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${sparkleHue}, 100%, 80%, ${pulseOpacity * 0.3 * Math.random()})`;
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Draw a beam segment - pure white for initial beams, spectral colors after glass
 * White beams are monochromatic and bright, spectral beams show chromatic dispersion
 */
function drawBeam(segment, alpha = 1.0) {
    const { x1, y1, x2, y2, intensity, insideGlass, wavelength, isWhite } = segment;

    // Check if this is a white beam (before glass interaction)
    const isWhiteBeam = isWhite || wavelength === null;

    let r, g, b, effectiveAlpha;

    if (isWhiteBeam) {
        // PURE WHITE BEAM - monochromatic, no color
        r = 255;
        g = 255;
        b = 255;
        effectiveAlpha = alpha * intensity * 1.2; // Extra bright white
    } else {
        // SPECTRAL BEAM - use wavelength color
        effectiveAlpha = alpha * intensity * wavelength.weight;

        // Get RGB values from wavelength color for manipulation
        const colorMatch = wavelength.color.match(/\d+/g);
        r = parseInt(colorMatch[0]);
        g = parseInt(colorMatch[1]);
        b = parseInt(colorMatch[2]);
    }

    // Optimized bloom effect - fewer layers for better performance
    const bloomLayers = [
        { width: 30, alpha: effectiveAlpha * 0.1 },   // Outer bloom
        { width: 18, alpha: effectiveAlpha * 0.3 },
        { width: 10, alpha: effectiveAlpha * 0.6 },
        { width: 4, alpha: effectiveAlpha * 0.9 },
        { width: 1.5, alpha: effectiveAlpha * 1.2 }   // Bright center
    ];

    // Draw main beam with bloom
    for (const layer of bloomLayers) {
        // Boost color intensity for brighter appearance
        const boostFactor = insideGlass ? 1.2 : 1.5;
        ctx.strokeStyle = `rgba(${Math.min(255, r * boostFactor)}, ${Math.min(255, g * boostFactor)}, ${Math.min(255, b * boostFactor)}, ${layer.alpha})`;
        ctx.lineWidth = layer.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // Add chromatic aberration edges ONLY for spectral beams (not white)
    if (!isWhiteBeam) {
        // Calculate perpendicular offset for edge colors
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy);

        if (length > 0) {
            const perpX = -dy / length;
            const perpY = dx / length;
            const edgeOffset = 2.5; // Pixels to offset chromatic edges

            // Red/orange edge on one side - OPTIMIZED (fewer layers)
            const redEdgeLayers = [
                { width: 4, alpha: effectiveAlpha * 0.4, color: 'rgb(255, 100, 70)' },
                { width: 1.5, alpha: effectiveAlpha * 0.7, color: 'rgb(255, 140, 90)' }
            ];

            for (const layer of redEdgeLayers) {
                ctx.strokeStyle = layer.color.replace('rgb', 'rgba').replace(')', `, ${layer.alpha})`);
                ctx.lineWidth = layer.width;
                ctx.lineCap = 'round';

                ctx.beginPath();
                ctx.moveTo(x1 + perpX * edgeOffset, y1 + perpY * edgeOffset);
                ctx.lineTo(x2 + perpX * edgeOffset, y2 + perpY * edgeOffset);
                ctx.stroke();
            }

            // Blue/violet edge on other side - OPTIMIZED (fewer layers)
            const blueEdgeLayers = [
                { width: 4, alpha: effectiveAlpha * 0.4, color: 'rgb(110, 130, 255)' },
                { width: 1.5, alpha: effectiveAlpha * 0.7, color: 'rgb(150, 170, 255)' }
            ];

            for (const layer of blueEdgeLayers) {
                ctx.strokeStyle = layer.color.replace('rgb', 'rgba').replace(')', `, ${layer.alpha})`);
                ctx.lineWidth = layer.width;
                ctx.lineCap = 'round';

                ctx.beginPath();
                ctx.moveTo(x1 - perpX * edgeOffset, y1 - perpY * edgeOffset);
                ctx.lineTo(x2 - perpX * edgeOffset, y2 - perpY * edgeOffset);
                ctx.stroke();
            }
        }
    }

    // Extra bright core for additive blending effect
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 255, 255, ${effectiveAlpha * 0.4})`;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
}

/**
 * Draw the light bar at bottom with angle indicator - PURE WHITE light source
 */
function drawLightBar() {
    const { x, y, width, height, angle } = lightBar;

    // Main bar with PURE WHITE gradient (bright center, fading edges)
    const barGradient = ctx.createLinearGradient(x - width / 2, y, x + width / 2, y);
    barGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    barGradient.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');  // Brightest at center
    barGradient.addColorStop(1, 'rgba(255, 255, 255, 0.6)');

    ctx.fillStyle = barGradient;
    ctx.fillRect(x - width / 2, y - height / 2, width, height);

    // Enhanced white glow around bar - EXTREMELY BRIGHT
    ctx.shadowColor = 'rgba(255, 255, 255, 1.0)';
    ctx.shadowBlur = 35;
    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    ctx.shadowBlur = 0;

    // Additional outer glow layers for maximum brightness
    for (let i = 0; i < 4; i++) {
        const glowSize = 25 + i * 18;
        const glowAlpha = 0.25 - i * 0.06;

        ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha})`;
        ctx.fillRect(
            x - width / 2 - glowSize / 2,
            y - height / 2 - glowSize / 2,
            width + glowSize,
            height + glowSize
        );
    }

    // Angle indicator - arc showing direction
    const indicatorRadius = 40;
    const angleRad = angle * (Math.PI / 180);

    ctx.beginPath();
    ctx.arc(x, y, indicatorRadius, Math.PI, 0, false);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Direction arrow - pure white
    const arrowLength = 35;
    const arrowX = x + Math.cos(angleRad) * arrowLength;
    const arrowY = y - Math.sin(angleRad) * arrowLength;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(arrowX, arrowY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Arrow head with white glow
    const headSize = 10;
    const headAngle = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
        arrowX - Math.cos(angleRad - headAngle) * headSize,
        arrowY + Math.sin(angleRad - headAngle) * headSize
    );
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
        arrowX - Math.cos(angleRad + headAngle) * headSize,
        arrowY + Math.sin(angleRad + headAngle) * headSize
    );
    ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Angle markers - subtle white
    for (let i = 0; i <= 180; i += 30) {
        const markerAngle = i * (Math.PI / 180);
        const innerR = indicatorRadius - 5;
        const outerR = indicatorRadius + 5;

        ctx.beginPath();
        ctx.moveTo(x + Math.cos(markerAngle) * innerR, y - Math.sin(markerAngle) * innerR);
        ctx.lineTo(x + Math.cos(markerAngle) * outerR, y - Math.sin(markerAngle) * outerR);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

/**
 * Main render function - Pure black background with prismatic light
 */
function render(time) {
    // Clear canvas with PURE BLACK - no gradients, no noise
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw glass blocks with iridescent animation
    for (const block of glassBlocks) {
        drawGlassBlock(block, time);
    }

    // Draw beams with smooth transition and additive blending for brightness
    ctx.globalCompositeOperation = 'lighter'; // Additive blending for overlapping colors

    if (beamTransition < 1.0) {
        // Fade out old beams
        for (const beam of previousBeams) {
            drawBeam(beam, 1.0 - beamTransition);
        }

        // Fade in new beams
        for (const beam of currentBeams) {
            drawBeam(beam, beamTransition);
        }

        // Progress transition
        beamTransition += 0.05;
        if (beamTransition > 1.0) beamTransition = 1.0;
    } else {
        // Draw current beams at full opacity
        for (const beam of currentBeams) {
            drawBeam(beam, 1.0);
        }
    }

    ctx.globalCompositeOperation = 'source-over'; // Reset blending

    // Draw light bar with spectral gradient
    drawLightBar();
}

// ============================================================================
// INTERACTION HANDLERS
// ============================================================================

function isOverLightBar(x, y) {
    return Math.abs(x - lightBar.x) < lightBar.width / 2 + 50 &&
           Math.abs(y - lightBar.y) < 50;
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isOverLightBar(x, y)) {
        isDragging = true;
        dragStartX = x;
        dragStartAngle = lightBar.angle;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
        // Map horizontal drag to angle change
        const dragDelta = x - dragStartX;
        const angleDelta = dragDelta * 0.3; // Sensitivity

        lightBar.targetAngle = dragStartAngle + angleDelta;
        lightBar.targetAngle = Math.max(0, Math.min(180, lightBar.targetAngle));

        // Update angle display
        angleDisplay.textContent = Math.round(lightBar.targetAngle) + '°';
    } else {
        // Change cursor when over light bar
        canvas.style.cursor = isOverLightBar(x, y) ? 'grab' : 'crosshair';
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    canvas.style.cursor = 'crosshair';
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (isOverLightBar(x, y)) {
        isDragging = true;
        dragStartX = x;
        dragStartAngle = lightBar.angle;
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isDragging) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;

        const dragDelta = x - dragStartX;
        const angleDelta = dragDelta * 0.3;

        lightBar.targetAngle = dragStartAngle + angleDelta;
        lightBar.targetAngle = Math.max(0, Math.min(180, lightBar.targetAngle));

        angleDisplay.textContent = Math.round(lightBar.targetAngle) + '°';
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isDragging = false;
});

// ============================================================================
// ANIMATION LOOP
// ============================================================================

let lastAngle = lightBar.angle;

function animate(timestamp) {
    animationTime = timestamp * 0.001;

    // Smooth angle interpolation
    const angleDiff = lightBar.targetAngle - lightBar.angle;
    lightBar.angle += angleDiff * 0.15; // Smooth damping

    // Check if angle changed significantly
    if (Math.abs(lightBar.angle - lastAngle) > 0.5) {
        updateBeams();
        lastAngle = lightBar.angle;
    }

    // Render the scene
    render(animationTime);

    // Continue animation loop
    requestAnimationFrame(animate);
}

// ============================================================================
// START
// ============================================================================

init();
