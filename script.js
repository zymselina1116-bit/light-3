/**
 * Interactive Kaleidoscope Experience
 *
 * Main Features:
 * - Smooth continuous rotation via mouse drag
 * - Pattern changes every 10 degrees of rotation
 * - Liquid, glowing, watery visual effects
 * - 60fps animation loop
 */

// ============================================================================
// GLOBAL STATE
// ============================================================================

const canvas = document.getElementById('kaleidoscope');
const ctx = canvas.getContext('2d');

// Rotation state
let totalRotation = 0;           // Total accumulated rotation in degrees
let currentRotation = 0;         // Current visual rotation angle
let lastPatternThreshold = 0;    // Last 10-degree threshold crossed

// Mouse/drag state
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let dragStartAngle = 0;

// Pattern configuration (changes every 10 degrees)
let pattern = generateNewPattern();

// Animation time for flicker effects
let animationTime = 0;

// ============================================================================
// CANVAS SETUP AND RESIZE
// ============================================================================

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================================================
// PATTERN GENERATION
// ============================================================================

/**
 * Generates a new random pattern configuration
 * Called whenever rotation crosses a 10-degree threshold
 */
function generateNewPattern() {
    // Random number of symmetry segments (4-12 for good kaleidoscope effect)
    const segments = Math.floor(Math.random() * 9) + 4;

    // Color palette - generate 3-5 complementary colors
    const hueBase = Math.random() * 360;
    const colorCount = Math.floor(Math.random() * 3) + 3;
    const colors = [];

    for (let i = 0; i < colorCount; i++) {
        const hue = (hueBase + (i * 360 / colorCount)) % 360;
        const saturation = 60 + Math.random() * 40;
        const lightness = 50 + Math.random() * 30;
        colors.push({ h: hue, s: saturation, l: lightness });
    }

    // Shape configuration
    const shapeTypes = ['circles', 'petals', 'polygons', 'spirals', 'stars'];
    const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

    // Pattern density (how many shapes per segment)
    const density = Math.floor(Math.random() * 5) + 3;

    // Layer count for depth
    const layers = Math.floor(Math.random() * 3) + 2;

    return {
        segments,
        colors,
        shapeType,
        density,
        layers,
        // Random offsets for variation
        offsetAngle: Math.random() * Math.PI * 2,
        scaleVariation: 0.5 + Math.random() * 0.5
    };
}

// ============================================================================
// MOUSE/TOUCH EVENT HANDLERS
// ============================================================================

/**
 * Calculate angle from center of canvas to mouse position
 */
function getAngleFromCenter(x, y) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    return Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
}

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    dragStartAngle = getAngleFromCenter(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // Calculate rotation based on angular movement around center
    const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
    let angleDelta = currentAngle - dragStartAngle;

    // Handle angle wraparound
    if (angleDelta > 180) angleDelta -= 360;
    if (angleDelta < -180) angleDelta += 360;

    // Update total rotation
    totalRotation += angleDelta;

    // Check if we crossed a 10-degree threshold
    const currentThreshold = Math.floor(totalRotation / 10) * 10;
    if (currentThreshold !== lastPatternThreshold) {
        lastPatternThreshold = currentThreshold;
        pattern = generateNewPattern();
    }

    dragStartAngle = currentAngle;
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
});

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    isDragging = true;
    lastMouseX = touch.clientX;
    lastMouseY = touch.clientY;
    dragStartAngle = getAngleFromCenter(touch.clientX, touch.clientY);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDragging) return;

    const touch = e.touches[0];
    const currentAngle = getAngleFromCenter(touch.clientX, touch.clientY);
    let angleDelta = currentAngle - dragStartAngle;

    if (angleDelta > 180) angleDelta -= 360;
    if (angleDelta < -180) angleDelta += 360;

    totalRotation += angleDelta;

    const currentThreshold = Math.floor(totalRotation / 10) * 10;
    if (currentThreshold !== lastPatternThreshold) {
        lastPatternThreshold = currentThreshold;
        pattern = generateNewPattern();
    }

    dragStartAngle = currentAngle;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isDragging = false;
});

// ============================================================================
// DRAWING UTILITIES
// ============================================================================

/**
 * Convert HSL color to CSS string with alpha
 */
function hslToString(color, alpha = 1) {
    return `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`;
}

/**
 * Draw a single shape with glowing, watery effect
 */
function drawShape(x, y, size, color, shapeType, time) {
    ctx.save();
    ctx.translate(x, y);

    // Subtle flicker effect
    const flicker = 0.85 + Math.sin(time * 2 + x * 0.01 + y * 0.01) * 0.15;
    const alpha = 0.3 + Math.sin(time * 3 + x * 0.02) * 0.2;

    // Outer glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
    gradient.addColorStop(0, hslToString(color, alpha * flicker * 0.6));
    gradient.addColorStop(0.5, hslToString(color, alpha * flicker * 0.3));
    gradient.addColorStop(1, hslToString(color, 0));

    ctx.fillStyle = gradient;

    switch (shapeType) {
        case 'circles':
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'petals':
            // Draw petal shape
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const r = size * (0.5 + 0.5 * Math.sin(angle * 2.5));
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;

        case 'polygons':
            // Draw hexagon
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const px = Math.cos(angle) * size;
                const py = Math.sin(angle) * size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;

        case 'spirals':
            // Draw spiral-like shape
            ctx.beginPath();
            for (let i = 0; i <= 20; i++) {
                const angle = (i / 20) * Math.PI * 4;
                const r = size * (i / 20);
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.lineWidth = size * 0.3;
            ctx.strokeStyle = hslToString(color, alpha * flicker);
            ctx.stroke();
            ctx.fill();
            break;

        case 'stars':
            // Draw star shape
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2;
                const r = size * (i % 2 === 0 ? 1 : 0.5);
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
    }

    ctx.restore();
}

/**
 * Draw shapes in a single segment (will be mirrored)
 */
function drawSegmentPattern(centerX, centerY, radius, time) {
    const { colors, shapeType, density, layers, offsetAngle, scaleVariation } = pattern;

    // Draw multiple layers for depth
    for (let layer = 0; layer < layers; layer++) {
        const layerRadius = radius * (0.3 + (layer / layers) * 0.7);

        // Draw shapes in this layer
        for (let i = 0; i < density; i++) {
            // Position along the radius
            const t = (i / density);
            const r = layerRadius * t;

            // Angle offset for variation
            const angleOffset = offsetAngle + layer * 0.3 + t * 0.5;
            const x = centerX + Math.cos(angleOffset) * r;
            const y = centerY + Math.sin(angleOffset) * r;

            // Size variation
            const size = (15 + t * 30) * scaleVariation * (0.8 + layer * 0.3);

            // Color from palette
            const colorIndex = (i + layer) % colors.length;
            const color = colors[colorIndex];

            drawShape(x, y, size, color, shapeType, time + layer * 0.5);
        }
    }
}

/**
 * Draw the complete kaleidoscope with mirrored segments
 */
function drawKaleidoscope() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;

    // Smooth rotation update
    currentRotation = totalRotation;

    // Draw each mirrored segment
    for (let i = 0; i < pattern.segments; i++) {
        const segmentAngle = (360 / pattern.segments);
        const angle = (currentRotation + i * segmentAngle) * (Math.PI / 180);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);

        // Clip to segment
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, 0, (Math.PI * 2) / pattern.segments);
        ctx.closePath();
        ctx.clip();

        // Draw pattern in this segment
        drawSegmentPattern(0, 0, radius, animationTime);

        ctx.restore();

        // Draw mirrored version
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        ctx.scale(1, -1); // Mirror vertically

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, 0, (Math.PI * 2) / pattern.segments);
        ctx.closePath();
        ctx.clip();

        drawSegmentPattern(0, 0, radius, animationTime);

        ctx.restore();
    }

    // Draw center glow
    const centerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.3);
    const centerColor = pattern.colors[0];
    centerGlow.addColorStop(0, hslToString(centerColor, 0.4));
    centerGlow.addColorStop(0.5, hslToString(centerColor, 0.1));
    centerGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw outer ring for definition
    ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

/**
 * Main animation loop - runs at 60fps
 */
function animate(timestamp) {
    // Update animation time for flicker effects
    animationTime = timestamp * 0.001; // Convert to seconds

    // Clear canvas with dark background
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add subtle background gradient
    const bgGradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2
    );
    bgGradient.addColorStop(0, 'rgba(26, 26, 46, 0.3)');
    bgGradient.addColorStop(1, 'rgba(10, 14, 26, 0.8)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the kaleidoscope
    drawKaleidoscope();

    // Continue animation loop
    requestAnimationFrame(animate);
}

// ============================================================================
// START THE EXPERIENCE
// ============================================================================

// Start animation loop
requestAnimationFrame(animate);
