// Echo Location Game MVP
// main.js

console.log("main.js loaded");

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js'; // Add WebXR VR Button
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'; // Add Controller Models

// Scene, Camera, Renderer
let scene, camera, renderer;
let controls;
// VR-specific variables
let isInVR = false;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let playerVelocity = new THREE.Vector3();
const playerSpeed = 10.0;
const PLAYER_ACCELERATION = 200.0; // How quickly player reaches max speed (INCREASED)
const PLAYER_FRICTION = 4.0;    // How quickly player slows down (DECREASED)
const PLAYER_SPRINT_MULTIPLIER = 2.0; // Speed boost when holding Shift (Adjusted from 5.0)
const playerHeight = 1.8; // Approximate height of the camera from the ground
let playerVerticalVelocity = 0.0; // NEW: For jump mechanics
let isJumping = false; // NEW: Jump state

const PLAYER_RADIUS = 0.3; // NEW: For XZ collision

// Objects
let floorSegments = []; // NEW: To store multiple floor segments
let walls = []; // NEW: To store maze walls
let echoableObjects = []; // To store floor, pillars, etc.

// Particle System for Echo
let particleSystem;
const MAX_PARTICLES = 50000; // Max particles in the pool
const PARTICLES_PER_ECHO = 5000; // REDUCED for quicker echo completion (was 20000)

// Input state
const keyboardState = {};

// Echo state - DEFINE THESE FIRST
const ECHO_HOLD_DURATION = 0.9; // seconds: How long particles stay bright
const ECHO_FADE_DURATION = 8.0; // seconds: How long particles take to fade (SLOWER FALL OFF)
const ECHO_FADE_IN_DURATION = 0.2; // seconds: How long particles take to fade in
const PROJECTILE_ECHO_PARTICLE_MULTIPLIER = 3.0; // INCREASED: Cast more particles for projectile echos

// NEW: Aftershock Constants - REMOVED: We're removing aftershock effects
// const AFTERSHOCK_DELAY = 0.3; // seconds: Delay after main pulse before aftershock starts
// const AFTERSHOCK_DURATION = 0.5; // seconds: Duration of the aftershock flare-up effect
// const AFTERSHOCK_MAX_ALPHA_BOOST = 0.65; // Max additional alpha at peak of aftershock (0 to 1)

// NOW DEFINE PARTICLE CONSTANTS THAT DEPEND ON THE ABOVE
const PARTICLE_INITIAL_LIFE = ECHO_FADE_IN_DURATION + ECHO_HOLD_DURATION + ECHO_FADE_DURATION; // Total lifespan 4.3s
const PARTICLE_BASE_SIZE = 0.03; 

// Lifecycle stages (based on life REMAINING)
const LIFESTAGE_FADEOUT_THRESHOLD = ECHO_FADE_DURATION; // When life <= this, particle is fading out (e.g., 4.0s)
const LIFESTAGE_HOLD_THRESHOLD = ECHO_FADE_DURATION + ECHO_HOLD_DURATION; // When life <= this, particle is holding (e.g., 4.1s)
// Fade-in happens when life > LIFESTAGE_HOLD_THRESHOLD

// Distance-based decay constants
const MAX_ECHO_DISTANCE_FOR_DECAY = 35.0; // Should match raycaster.far or desired max effect distance
const DISTANCE_DECAY_RATE_MULTIPLIER = 3.0; // For particles at echo origin, life decays (1+X) times faster. X is this value. (e.g. 3.0 means 4x faster)

// Timing
const clock = new THREE.Clock();

// NEW: Active Aftershocks Array - REMOVED: We're removing aftershock tracking
// let activeAftershocks = [];

// NEW: Web Audio API Context
let audioContext;

// NEW: Storage for preloaded AudioBuffers
const echoSoundBuffers = {};
const powerUpEchoSoundBuffers = {};
let fallSoundBuffer; // NEW: Buffer for fall sound
let pickupSoundBuffer; // NEW: Buffer for pickup sound
const projectileEchoSoundBuffers = {}; // NEW: Buffers for projectile echo sounds

// NEW: Footstep Sound Variables
let footstepSoundBuffer;
let footstepSourceNode = null;
let footstepGainNode;
let stopFootstepTimeout = null;
const FOOTSTEP_SOUND_FILE = 'footsteps.mp3';
const FOOTSTEP_BASE_PLAYBACK_RATE = 1.0;
const FOOTSTEP_SPRINT_PLAYBACK_RATE = 1.6;
const FOOTSTEP_FADE_DURATION_MS = 200; // Milliseconds for fade in/out
const FOOTSTEP_STOP_DELAY_MS = FOOTSTEP_FADE_DURATION_MS + 100; // Delay before actually stopping the source node

// NEW: BPM-based Visual Pulse Constants & State
const BEAT_PULSE_BPM = 120.0;
const EIGHTH_NOTE_INTERVAL_MS = (60000.0 / BEAT_PULSE_BPM) / 2.0; // Calculate 1/8th note interval

const BEAT_PULSE_INTERVAL_MS = EIGHTH_NOTE_INTERVAL_MS; // Pulse on 1/8th notes
const BEAT_VISUAL_PULSE_EFFECT_DURATION_MS = BEAT_PULSE_INTERVAL_MS * 0.8; // Visual pulse is sharp, e.g. 80% of 1/8th note interval
const BEAT_VISUAL_PULSE_MAX_ALPHA_BOOST = 0.35; // Max additional alpha (0 to 1) - slightly increased for more impact

let beatTrackAudioStartTime = -1; // When bgambiencebeat.mp3 actually started (audioContext.currentTime)
let lastProcessedBeatCount = -1;
let isBeatVisualPulseActive = false;
let beatVisualPulseEffect_StartTime = 0; // audioContext.currentTime when the visual pulse effect started

// NEW: Filename arrays (re-added for Web Audio loading)
const echoNoteFilenames = [
    'notes/echonote1.mp3',
    'notes/echonote2.mp3',
    'notes/echonote3.mp3',
    'notes/echonote4.mp3'
];
const powerUpEchoNoteFilenames = [
    'notes/redechonote1.mp3',
    'notes/redechonote2.mp3',
    'notes/redechonote3.mp3',
    'notes/redechonote4.mp3'
];
const projectileEchoNoteFilenames = [ // NEW: Filenames for projectile echo sounds
    'notes/purpleechonote1.mp3',
    'notes/purpleechonote2.mp3',
    'notes/purpleechonote3.mp3',
    'notes/purpleechonote4.mp3'
];

// NEW: Indices for cycling sounds (re-added)
let currentEchoNoteIndex = 0;
let currentPowerUpEchoNoteIndex = 0;
let currentProjectileEchoNoteIndex = 0; // NEW: Index for projectile echo sounds

// NEW: Background Ambiance (still HTMLAudioElement for simplicity of looping background track)
let backgroundAmbianceSound;
let backgroundBeatSound; // NEW: For the layered beat track
let startBeatSoundTimeout = null; // NEW: Timeout ID for scheduling beat sound

// NEW: Flag for ambiance sound
let hasAmbianceStarted = false;

// Reticle
let reticle;

const testSlotIndex = 5; // STATIC SLOT FOR THIS TEST
const singleTestParticleColor = new THREE.Color(0x00ffff); // Bright Cyan for this specific test

const JUMP_INITIAL_VELOCITY = 7.0; // NEW
const GRAVITY = 19.6; // NEW

const WALL_HEIGHT = 8.0; // NEW: Maze wall height - CHANGED
const WALL_THICKNESS = 0.5; // NEW: Maze wall thickness

const PIT_CENTER_X = 22.5; // NEW
const PIT_CENTER_Z = -2.5; // NEW
const PIT_SIZE = 5.0;      // NEW
const PIT_HALF_SIZE = PIT_SIZE / 2; // NEW
const DEATH_Y_LEVEL = -10.0; // NEW

let PLAYER_START_X = -12;
let PLAYER_START_Z = 0;

// Power-up Constants & State - NEW
const POWERUP_DURATION = 30.0; // seconds
const POWERUP_COLOR = new THREE.Color(0xff0000); // Red
const NORMAL_ECHO_COLOR = new THREE.Color(0x00ffff); // Existing echo color
const PROJECTILE_ECHO_PARTICLE_COLOR = new THREE.Color(0x800080); // Purple for projectile echo particles
const PROJECTILE_PICKUP_VISIBLE_COLOR = new THREE.Color(0x6A0DAD); // Visible purple for the pickup item
const POWERUP_RAYCASTER_FAR = 15.0;
const NORMAL_RAYCASTER_FAR = 35.0; // Default echo range
const PROJECTILE_ECHO_RAYCASTER_FAR = 45.0; // NEW: Dedicated far distance for projectile echo
let POWERUP_ECHO_FADE_DURATION; // Will be set in init based on ECHO_FADE_DURATION

let powerUpSphereMesh;
let isPowerUpActive = false;
let powerUpRemainingTime = 0;

let projectilePowerUpSphereMesh; // NEW: Purple pickup mesh
let isProjectileEchoPowerUpActive = false; // NEW: State for purple power-up
let projectilePowerUpRemainingTime = 0; // NEW: Timer for purple power-up duration
const PROJECTILE_POWERUP_DURATION = 30.0; // NEW: Duration in seconds for purple power-up

let isPlayerDead = false; // NEW: Player dead state
const DEATH_SCREEN_DURATION = 2500; // NEW: Milliseconds for death screen

// HTML Element References for death screen - get them once in init
let deathTintElement;
let deathMessageElement;

// NEW: Projectile State
let tossedProjectileMeshes = []; // Array of projectile meshes
let tossedProjectileVelocities = []; // Array of velocities
let projectileCurrentLives = []; // Array of lifetimes
let isProjectileInFlight = false; // Flag for any projectile in flight
const MAX_PROJECTILES = 5; // Maximum number of projectiles allowed in flight
const PROJECTILE_SPEED = 25.0;
const PROJECTILE_MAX_LIFE = 3.0; // seconds

// Mini-map variables
let miniMapCanvas;
let miniMapContext;
let miniMapScale = 2.5; // Increased scale for better visibility

// Controller input state
let vrControllerInputs = {
    left: {
        thumbstickX: 0,
        thumbstickY: 0,
        thumbstickPressed: false
    },
    right: {
        thumbstickX: 0,
        thumbstickY: 0,
        thumbstickPressed: false
    }
};

// VR movement constants
const VR_MOVE_SPEED = 3.0; // Reduced from 10.0 for more comfortable movement
const VR_TELEPORT_DISTANCE = 5.0; // Units for teleport mode
const VR_COLLISION_RADIUS = 0.4; // Player collision radius in VR

// NEW: Array to track active impact flashes for guaranteed cleanup
let activeImpactFlashes = [];
const MAX_FLASH_AGE = 500; // milliseconds

// NEW: Puzzle Door Constants and State
let puzzleDoorMesh, puzzleDoorTarget1Mesh, puzzleDoorTarget2Mesh;
let isPuzzleDoorActive = false; // Is the door challenge currently active (spawned)?
let isPuzzleDoorTarget1Hit = false;
let isPuzzleDoorTarget2Hit = false;
let isPuzzleDoorOpen = false;
let puzzleDoorSpawnLocation = null; // THREE.Vector3, set by buildMaze
let puzzleDoorSpawnOrientation = 'horizontal'; // 'horizontal' or 'vertical'

const PUZZLE_DOOR_TARGET_COLOR = new THREE.Color(0x00ff00); // Green
const PUZZLE_DOOR_TARGET_HIT_COLOR = new THREE.Color(0xffff00); // Yellow
const PUZZLE_DOOR_PANEL_COLOR = new THREE.Color(0x4a2a00); // Dark wood-like brown
const PUZZLE_DOOR_FRAME_COLOR = new THREE.Color(0x301c00); // Darker brown for frame
const DOOR_WIDTH = 4;
const DOOR_HEIGHT = 6; // Taller than player
const DOOR_THICKNESS = 0.5;
const DOOR_TARGET_RADIUS = 0.3;
const DOOR_TARGET_THICKNESS = 0.1;

// Sounds (to be loaded in init)
let doorTargetHitSoundBuffer = null;
let doorOpenSoundBuffer = null;
// END NEW Puzzle Door

// Function declarations moved BEFORE init()

function easeOutCubic(t) { // t is from 0 to 1
    return 1 - Math.pow(1 - t, 3);
}

function scheduleBeatSoundStart() {
    console.log("[scheduleBeatSoundStart] Called. Projectile PU Active:", isProjectileEchoPowerUpActive, "Beat Sound Loaded:", backgroundBeatSound && backgroundBeatSound.readyState >= 2, "Beat Sound Playing:", backgroundBeatSound && backgroundBeatSound.currentTime > 0 && !backgroundBeatSound.paused );
    if (startBeatSoundTimeout) {
        clearTimeout(startBeatSoundTimeout);
        startBeatSoundTimeout = null;
    }

    // --- MODIFIED: Play immediately if power-up active and sound is loaded & paused --- 
    if (isProjectileEchoPowerUpActive && backgroundBeatSound && backgroundBeatSound.readyState >= 2 && backgroundBeatSound.paused) {
        console.log("[scheduleBeatSoundStart] Attempting to play backgroundBeatSound immediately.");
        backgroundBeatSound.play().then(() => {
            console.log("backgroundBeatSound started immediately.");
            if (audioContext) beatTrackAudioStartTime = audioContext.currentTime; // Record start time for visual pulse
            lastProcessedBeatCount = -1; // Reset beat count
            isBeatVisualPulseActive = false; // Ensure visual pulse is not stuck active
        }).catch(e => console.error("Error playing backgroundBeatSound (immediate attempt):", e));
    } else if (!isProjectileEchoPowerUpActive) {
        console.log("[scheduleBeatSoundStart] Returning early: Projectile PowerUp not active.");
    } else if (!backgroundBeatSound || backgroundBeatSound.readyState < 2) {
        console.log("[scheduleBeatSoundStart] Returning early: backgroundBeatSound not loaded/ready.");
    } else if (!backgroundBeatSound.paused) {
        console.log("[scheduleBeatSoundStart] backgroundBeatSound is already playing.");
        // If it's already playing and beatTrackAudioStartTime is not set, set it now.
        if (beatTrackAudioStartTime === -1 && audioContext) {
            beatTrackAudioStartTime = audioContext.currentTime - backgroundBeatSound.currentTime; // Estimate original start time
            lastProcessedBeatCount = Math.floor(((audioContext.currentTime - beatTrackAudioStartTime) * 1000) / BEAT_PULSE_INTERVAL_MS) -1 ;
            console.log("backgroundBeatSound was already playing, re-syncing beatTrackAudioStartTime");
        }
    }
    // --- END OF MODIFIED SECTION ---
}

function stopBeatSound() {
    if (startBeatSoundTimeout) {
        clearTimeout(startBeatSoundTimeout);
        startBeatSoundTimeout = null;
    }
    if (backgroundBeatSound) {
        backgroundBeatSound.pause();
        backgroundBeatSound.currentTime = 0;
        console.log("backgroundBeatSound stopped and reset.");
    }
    // NEW: Reset BPM pulse state variables
    beatTrackAudioStartTime = -1;
    lastProcessedBeatCount = -1;
    isBeatVisualPulseActive = false;
}

const raycaster = new THREE.Raycaster();
let particleIndex = 0; 

// NEW: Function to load and decode audio for Web Audio API
async function loadAudioBuffer(url) {
    if (!audioContext) {
        console.error("AudioContext not initialized. Cannot load audio buffer.");
        return null;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        console.error(`Error loading audio buffer for ${url}:`, error);
        return null;
    }
}

// Add these global variables for progressive particle generation
let pendingEchoes = []; // Queue of echo requests to process
const PARTICLES_PER_FRAME = 10000; // GREATLY increased for much faster echo processing

// Modify the triggerEcho function to queue requests instead of processing immediately
function triggerEcho(originPoint, echoColorOverride) {
    if (isPlayerDead) return;
    if (!audioContext) { 
        console.warn("AudioContext not ready, cannot play echo sound.");
        return;
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    console.log("Echo triggered, queueing particles");

    // Sound Playback Logic - MOVED to the beginning of the function
    let soundBufferToPlay = null;
    let soundFileName = ""; 

    if (echoColorOverride === PROJECTILE_ECHO_PARTICLE_COLOR) { // Check for projectile echo first
        if (projectileEchoNoteFilenames.length > 0) {
            soundFileName = projectileEchoNoteFilenames[currentProjectileEchoNoteIndex];
            soundBufferToPlay = projectileEchoSoundBuffers[soundFileName];
            currentProjectileEchoNoteIndex = (currentProjectileEchoNoteIndex + 1) % projectileEchoNoteFilenames.length;
        }
    } else if (isPowerUpActive) { // Then check for Red power-up (shorter range, different particle color, red sounds)
        if (powerUpEchoNoteFilenames.length > 0) {
            soundFileName = powerUpEchoNoteFilenames[currentPowerUpEchoNoteIndex];
            soundBufferToPlay = powerUpEchoSoundBuffers[soundFileName];
            currentPowerUpEchoNoteIndex = (currentPowerUpEchoNoteIndex + 1) % powerUpEchoNoteFilenames.length;
        }
    } else { // Normal player echo sounds
        if (echoNoteFilenames.length > 0) {
            soundFileName = echoNoteFilenames[currentEchoNoteIndex];
            soundBufferToPlay = echoSoundBuffers[soundFileName];
            currentEchoNoteIndex = (currentEchoNoteIndex + 1) % echoNoteFilenames.length;
        }
    }

    // Play sound immediately before starting particle calculations
    if (soundBufferToPlay) {
        const source = audioContext.createBufferSource();
        source.buffer = soundBufferToPlay;
        source.connect(audioContext.destination);
        source.start(0); 
    } else if (soundFileName) {
        console.warn(`Audio buffer for ${soundFileName} not found or not loaded yet.`);
    }

    // Determine number of particles to cast for this specific echo
    let numParticlesToCast = PARTICLES_PER_ECHO;
    
    // SIMPLIFIED: Use same particle count for all echo types for consistency
    // No special multiplier for projectile echo

    // Determine echo particle color and raycaster distance
    let currentEchoColorToUse;
    let currentRaycasterFar;

    if (echoColorOverride) { // Projectile echo uses its specific color
        currentEchoColorToUse = echoColorOverride;
        currentRaycasterFar = PROJECTILE_ECHO_RAYCASTER_FAR; 
    } else if (isPowerUpActive) { // Red power-up (shorter range, different particle color)
        currentEchoColorToUse = POWERUP_COLOR; // Red particles for red power-up
        currentRaycasterFar = POWERUP_RAYCASTER_FAR;
    } else { // Normal player echo
        currentEchoColorToUse = NORMAL_ECHO_COLOR;
        currentRaycasterFar = NORMAL_RAYCASTER_FAR;
    }

    // Important: Use the originPoint if provided (for projectile impacts)
    // otherwise default to camera position (for player echos)
    const echoOrigin = originPoint ? originPoint.clone() : camera.position.clone();

    // Queue the echo for progressive processing
    pendingEchoes.push({
        origin: echoOrigin,
        color: currentEchoColorToUse,
        raycasterFar: currentRaycasterFar,
        particlesRemaining: numParticlesToCast,
        particlesTotal: numParticlesToCast,
        startIndex: 0,
        startTime: clock.elapsedTime
    });
}

// Add a new function to process echo particles progressively
function processEchoParticles() {
    if (pendingEchoes.length === 0) return;
    
    // Process the oldest echo request first
    const echo = pendingEchoes[0];
    
    // Set up raycaster with the appropriate distance
    raycaster.far = echo.raycasterFar;
    
    const posArray = particleSystem.geometry.attributes.position.array;
    const colArray = particleSystem.geometry.attributes.color.array;
    const sizeArray = particleSystem.geometry.attributes.size.array;
    const lifeArray = particleSystem.geometry.attributes.life.array;
    const echoDistanceArray = particleSystem.geometry.attributes.echoDistance.array;
    
    let particlesActivatedThisBatch = 0;
    
    // SIMPLIFIED: All echo types process the same number of particles per frame
    const particlesToProcess = Math.min(PARTICLES_PER_FRAME, echo.particlesRemaining);
    
    // Check if this is a projectile echo (purple)
    const isPurpleEcho = echo.color.equals(PROJECTILE_ECHO_PARTICLE_COLOR);
    
    // Process a batch of particles
    for (let i = 0; i < particlesToProcess; i++) {
        // Calculate particle index relative to the total for this echo
        const relativeIndex = echo.startIndex + i;
        
        // Generate ray direction using spherical coordinates for even distribution
        const phi = Math.acos(-1 + (2 * relativeIndex) / echo.particlesTotal);
        const theta = Math.sqrt(echo.particlesTotal * Math.PI) * phi;
        
        const direction = new THREE.Vector3(
            Math.cos(theta) * Math.sin(phi),
            Math.sin(theta) * Math.sin(phi),
            Math.cos(phi)
        );
        
        raycaster.set(echo.origin, direction);
        const intersects = raycaster.intersectObjects(echoableObjects, false);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const point = intersection.point;
            particlesActivatedThisBatch++;
            const pIdx = particleIndex % MAX_PARTICLES;

            posArray[pIdx * 3 + 0] = point.x;
            posArray[pIdx * 3 + 1] = point.y;
            posArray[pIdx * 3 + 2] = point.z;

            // Determine particle color: special highlight for power-up sphere
            let finalParticleColor = echo.color;
            if (intersection.object === powerUpSphereMesh && powerUpSphereMesh.visible) {
                finalParticleColor = POWERUP_COLOR; // Highlight with power-up's own red color
            }

            colArray[pIdx * 4 + 0] = finalParticleColor.r;
            colArray[pIdx * 4 + 1] = finalParticleColor.g;
            colArray[pIdx * 4 + 2] = finalParticleColor.b;
            
            // IMPROVED: Start purple projectile particles with higher initial alpha
            if (isPurpleEcho) {
                colArray[pIdx * 4 + 3] = 0.6; // Start more visible for projectiles
                sizeArray[pIdx] = PARTICLE_BASE_SIZE * 1.5; // Slightly larger size for projectile particles
            } else {
                // Standard fade-in for other echoes
                colArray[pIdx * 4 + 3] = 0.0; // Start invisible and fade in
                sizeArray[pIdx] = 0.0; // Start with zero size and grow
            }
            
            lifeArray[pIdx] = PARTICLE_INITIAL_LIFE;
            
            const distance = point.distanceTo(echo.origin); 
            echoDistanceArray[pIdx] = distance;
            
            particleIndex++;
        }
    }
    
    // Update echo request
    echo.startIndex += particlesToProcess;
    echo.particlesRemaining -= particlesToProcess;
    
    // Update buffers if any particles were created
    if (particlesActivatedThisBatch > 0) {
        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.color.needsUpdate = true;
        particleSystem.geometry.attributes.size.needsUpdate = true;
        particleSystem.geometry.attributes.life.needsUpdate = true; 
        particleSystem.geometry.attributes.echoDistance.needsUpdate = true; 
        particleSystem.geometry.computeBoundingSphere();
    }
    
    // If this echo is finished, remove from queue
    if (echo.particlesRemaining <= 0) {
        // Just remove this echo from the queue
        pendingEchoes.shift();
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function init() {
    // NEW: Initialize AudioContext
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext initialized.");
    } catch (e) {
        console.error("Web Audio API is not supported in this browser.", e);
        // Fallback or error message if needed
    }

    // Initialize Mini-map
    miniMapCanvas = document.getElementById('miniMap');
    if (miniMapCanvas) {
        miniMapCanvas.width = 200;
        miniMapCanvas.height = 200;
        miniMapContext = miniMapCanvas.getContext('2d');
        console.log("Mini-map initialized.");
    } else {
        console.warn("Mini-map canvas not found.");
    }

    // Create scene
    scene = new THREE.Scene();
    
    // Camera with your original settings
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, NORMAL_RAYCASTER_FAR);
    camera.position.set(2, playerHeight, 18); // Start position for maze
    
    // Renderer - maintain original canvas reference and properties
    const canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000); // Black background
    renderer.shadowMap.enabled = true;
    renderer.xr.enabled = true; // Enable WebXR
    
    // Add VR button and handle session change events
    document.body.appendChild(VRButton.createButton(renderer));
    renderer.xr.addEventListener('sessionstart', () => onVRSessionChange(renderer.xr.getSession()));
    renderer.xr.addEventListener('sessionend', () => onVRSessionChange(null));
    
    // VR-specific variables
    isInVR = false;
    
    // Setup VR controllers
    setupVRControllers();
    
    // Basic Ambient Light (very dim)
    const ambientLight = new THREE.AmbientLight(0x050505); // Even dimmer, relying on particles
    scene.add(ambientLight);

    // Floor - MODIFIED to have a pit
    // const floorGeometry = new THREE.PlaneGeometry(100, 100); // Made floor larger to accommodate maze
    const baseMaterialProps = {
        color: 0x080808,
        roughness: 0.9,
        metalness: 0.1,
    };
    // floor = new THREE.Mesh(floorGeometry, floorMaterial);
    // floor.rotation.x = -Math.PI / 2; 
    // scene.add(floor);
    // echoableObjects.push(floor);

    createSegmentedFloorWithPit(
        100, // total width of the area including pit
        100, // total depth of the area including pit
        PIT_CENTER_X, 
        PIT_CENTER_Z, 
        PIT_SIZE, 
        baseMaterialProps
    );

    // Create Power-up Sphere - NEW
    POWERUP_ECHO_FADE_DURATION = ECHO_FADE_DURATION * 2.5; // Define it here
    const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16); // Restored original size
    const sphereMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222, // Dark grey, like walls
        emissive: 0x000000, // No self-glow initially
        emissiveIntensity: 0 // No self-glow initially
    });
    powerUpSphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    // NEW Position: Center of the first large room
    powerUpSphereMesh.position.set(-7.5, playerHeight, 0.0); 
    scene.add(powerUpSphereMesh);
    echoableObjects.push(powerUpSphereMesh); 
    powerUpSphereMesh.userData.aabb = new THREE.Box3().setFromObject(powerUpSphereMesh);
    powerUpSphereMesh.userData.isPowerUp = true; // Tag it
    console.log("Power-up sphere (red) created at:", powerUpSphereMesh.position);
    console.log("Player starting at:", camera.position);

    // NEW: Create Projectile Power-up Sphere (Purple)
    const projectileSphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const projectileSphereMaterial = new THREE.MeshStandardMaterial({
        color: PROJECTILE_PICKUP_VISIBLE_COLOR, // Directly visible purple
        roughness: 0.6,
        metalness: 0.2
    });
    projectilePowerUpSphereMesh = new THREE.Mesh(projectileSphereGeometry, projectileSphereMaterial);
    // Position: Back near the red sphere for easier testing
    projectilePowerUpSphereMesh.position.set(-5.0, playerHeight, 0.0); 
    scene.add(projectilePowerUpSphereMesh);
    echoableObjects.push(projectilePowerUpSphereMesh);
    projectilePowerUpSphereMesh.userData.aabb = new THREE.Box3().setFromObject(projectilePowerUpSphereMesh);
    projectilePowerUpSphereMesh.userData.isProjectilePowerUp = true; // Tag it
    console.log("Projectile Power-up sphere (purple) created at:", projectilePowerUpSphereMesh.position);

    // Maze Walls - MOVED after power-up creation
    buildMaze(); // Call function to construct the maze

    // Initialize Particle System
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 4); // MODIFIED: RGBA
    const sizes = new Float32Array(MAX_PARTICLES);
    const life = new Float32Array(MAX_PARTICLES);
    const echoDistances = new Float32Array(MAX_PARTICLES); // NEW: For distance-based fade

    for (let i = 0; i < MAX_PARTICLES; i++) {
        positions[i * 3 + 0] = 0;
        positions[i * 3 + 1] = -1000; // Start offscreen
        positions[i * 3 + 2] = 0;
        colors[i * 4 + 0] = 0; // R
        colors[i * 4 + 1] = 0; // G
        colors[i * 4 + 2] = 0; // B
        colors[i * 4 + 3] = 0.0; // A - Initialize alpha to 0
        life[i] = 0.0;
        sizes[i] = PARTICLE_BASE_SIZE; // Initialize size attribute
        echoDistances[i] = 0.0; // NEW: Initialize distance
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 4)); // MODIFIED: itemSize 4
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('life', new THREE.BufferAttribute(life, 1));
    particleGeometry.setAttribute('echoDistance', new THREE.BufferAttribute(echoDistances, 1)); // NEW

    const particleMaterial = new THREE.PointsMaterial({
        size: PARTICLE_BASE_SIZE, 
        vertexColors: true, 
        transparent: true,  // ENABLE TRANSPARENCY
        depthWrite: false, // RECOMMENDED FOR TRANSPARENT PARTICLES
        // blending: THREE.AdditiveBlending, // Optional: for a glowier effect, try later if desired
        opacity: 1.0, // Material base opacity, per-particle alpha will modulate this
        sizeAttenuation: true,
    });
    console.log("Particle material: transparent=true, depthWrite=false, vertexColors=true");

    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // Pointer Lock Controls
    controls = new PointerLockControls(camera, renderer.domElement);
    document.addEventListener('click', () => {
        if (isPlayerDead) return;

        // Resume AudioContext if suspended (important for some browsers)
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log("AudioContext resumed on user click.");
            }).catch(e => console.error("Error resuming AudioContext:", e));
        }

        // Attempt to start ambiance sound on first click
        if (backgroundAmbianceSound && !hasAmbianceStarted) {
            backgroundAmbianceSound.play()
                .then(() => {
                    hasAmbianceStarted = true;
                    console.log("Background ambiance started successfully after user click.");
                    if (isProjectileEchoPowerUpActive) { // If projectile power-up already active
                        scheduleBeatSoundStart();
                    }
                })
                .catch(error => {
                    console.warn("Background ambiance play failed on click. Browser policy might still be in effect or sound not ready.", error);
                });
        }

        if (!controls.isLocked) {
            controls.lock();
        }
        
        // MODIFIED: Handle click based on projectile power-up state
        if (isProjectileEchoPowerUpActive && !isProjectileInFlight) {
            throwProjectile();
            // Echo will be triggered by projectile impact, not directly on click here
        } else {
            // Standard echo from player
            triggerEcho(); 
        }
    });

    controls.addEventListener('lock', () => {
        console.log('Pointer locked');
        if (reticle) reticle.style.display = 'block';
        // Hide death screen elements if they are visible
        const deathTint = document.getElementById('death-tint');
        const deathMessage = document.getElementById('death-message');
        if (deathTint) deathTint.style.display = 'none';
        if (deathMessage) deathMessage.style.display = 'none';

    });

    controls.addEventListener('unlock', () => {
        console.log('Pointer unlocked');
        if (reticle) reticle.style.display = 'none';
        // Optionally, show a pause menu or similar here
        // For now, if player is dead and pointer unlocks, keep death screen.
        if (isPlayerDead) {
            const deathTint = document.getElementById('death-tint');
            const deathMessage = document.getElementById('death-message');
            if (deathTint) deathTint.style.display = 'block';
            if (deathMessage) deathMessage.style.display = 'flex';
        }
    });

    scene.add(controls.getObject());

    // Keyboard listeners for movement and echo
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Load sound - OLD single echo sound logic REMOVED
    // NEW: Load all echo sounds into buffers using Web Audio API
    if (audioContext) {
        const allSoundPromises = [];

        echoNoteFilenames.forEach(filename => {
            const promise = loadAudioBuffer(filename).then(buffer => {
                if (buffer) echoSoundBuffers[filename] = buffer;
            });
            allSoundPromises.push(promise);
        });

        powerUpEchoNoteFilenames.forEach(filename => {
            const promise = loadAudioBuffer(filename).then(buffer => {
                if (buffer) powerUpEchoSoundBuffers[filename] = buffer;
            });
            allSoundPromises.push(promise);
        });

        // NEW: Load fall sound
        const fallSoundPromise = loadAudioBuffer('fallsound.mp3').then(buffer => {
            if (buffer) fallSoundBuffer = buffer;
        });
        allSoundPromises.push(fallSoundPromise);

        // NEW: Load pickup sound (used by both red and purple pickups now)
        const pickupSoundPromise = loadAudioBuffer('pickupsound.mp3').then(buffer => {
            if (buffer) pickupSoundBuffer = buffer;
        });
        allSoundPromises.push(pickupSoundPromise);

        // NEW: Load projectile echo sounds
        projectileEchoNoteFilenames.forEach(filename => {
            const promise = loadAudioBuffer(filename).then(buffer => {
                if (buffer) projectileEchoSoundBuffers[filename] = buffer;
            });
            allSoundPromises.push(promise);
        });

        // NEW: Load Door Sounds
        const doorTargetHitSoundPromise = loadAudioBuffer('door_target_hit.mp3').then(buffer => {
            if (buffer) doorTargetHitSoundBuffer = buffer;
        });
        allSoundPromises.push(doorTargetHitSoundPromise);

        const doorOpenSoundPromise = loadAudioBuffer('door_open_sound.mp3').then(buffer => {
            if (buffer) doorOpenSoundBuffer = buffer;
        });
        allSoundPromises.push(doorOpenSoundPromise);
        // END NEW Door Sounds

        // NEW: Load footstep sound
        const footstepSoundPromise = loadAudioBuffer(FOOTSTEP_SOUND_FILE).then(buffer => {
            if (buffer) {
                footstepSoundBuffer = buffer;
                console.log("Footstep sound loaded successfully.");
            } else {
                console.warn("Footstep sound buffer could not be loaded.");
            }
        });
        allSoundPromises.push(footstepSoundPromise);

        Promise.all(allSoundPromises)
            .then(() => console.log("All sound buffers loaded (or attempted).")) // Updated log message
            .catch(error => console.error("Error loading some sound buffers:", error));
    }

    // NEW: Load and play background ambiance sound (still HTMLAudioElement for loop simplicity)
    backgroundAmbianceSound = new Audio('bgambience.mp3');
    backgroundAmbianceSound.loop = true;
    backgroundAmbianceSound.addEventListener('canplaythrough', () => {
        console.log("Background ambiance 'bgambience.mp3' can play through.");
        // Removed automatic play from here
        // backgroundAmbianceSound.play().catch(error => {
        //     console.warn("Background ambiance play failed on load. This can happen due to browser autoplay policies.", error);
        // });
    });
    backgroundAmbianceSound.addEventListener('error', (e) => {
        console.error("Error loading background ambiance 'bgambience.mp3':", e);
    });
    backgroundAmbianceSound.preload = 'auto'; // Start loading it

    // NEW: Load and prepare background beat sound
    console.log("Attempting to create Audio object for bgambiencebeat.mp3");
    backgroundBeatSound = new Audio('bgambiencebeat.mp3');
    console.log("backgroundBeatSound object created:", backgroundBeatSound);
    backgroundBeatSound.loop = true;
    backgroundBeatSound.addEventListener('canplaythrough', () => {
        console.log("Background beat sound 'bgambiencebeat.mp3' can play through.");
    });
    backgroundBeatSound.addEventListener('error', (e) => {
        console.error("ERROR LOADING background beat sound 'bgambiencebeat.mp3':", e);
        // Additional details that might be helpful
        if (backgroundBeatSound) {
            console.error("backgroundBeatSound error code:", backgroundBeatSound.error?.code);
            console.error("backgroundBeatSound networkState:", backgroundBeatSound.networkState);
        }
    });
    backgroundBeatSound.preload = 'auto';
    try {
        backgroundBeatSound.load(); // Explicitly call load
        console.log("backgroundBeatSound.load() called.");
    } catch (e) {
        console.error("Error calling backgroundBeatSound.load():", e);
    }

    // Get HTML elements for death screen
    deathTintElement = document.getElementById('death-tint');
    deathMessageElement = document.getElementById('death-message');
    if (!deathTintElement || !deathMessageElement) {
        console.warn("Death screen HTML elements not found! Ensure #death-tint and #death-message are in your HTML.");
    }

    // Get HTML element for reticle - MODIFIED
    reticle = document.getElementById('reticle'); // Assign to the global 'reticle' variable
    if (!reticle) { // Check the global 'reticle' variable
        console.warn("Reticle HTML element #reticle not found! Ensure it is in your HTML.");
    }

    // NEW: Initialize Footstep GainNode
    if (audioContext) {
        footstepGainNode = audioContext.createGain();
        footstepGainNode.gain.value = 0; // Start silent
        footstepGainNode.connect(audioContext.destination);
    }

    console.log("Three.js scene initialized. Click to enable pointer lock and trigger echo. WASD to move.");
    animate();
}

function onKeyDown(event) {
    if (isPlayerDead) return; // NEW: Check player dead state
    keyboardState[event.code] = true;
    if (event.code === 'Space' && !isJumping) {
        isJumping = true;
        playerVerticalVelocity = JUMP_INITIAL_VELOCITY;
    }
}

function onKeyUp(event) {
    keyboardState[event.code] = false;
}

function handlePlayerMovement(deltaTime) {
    if (!controls.isLocked) {
        playerVelocity.set(0,0,0); // Stop all horizontal movement if not locked
        // Still process vertical movement (gravity/jump landing) if needed
        // For now, we will also stop vertical processing if not locked for simplicity, 
        // but this might change if e.g. player can fall while menu is open.
    } else {
        // --- Horizontal Movement (with momentum) ---
        const inputDirection = new THREE.Vector3();
        if (keyboardState['KeyW'] || keyboardState['ArrowUp']) inputDirection.z -= 1;
        if (keyboardState['KeyS'] || keyboardState['ArrowDown']) inputDirection.z += 1;
        if (keyboardState['KeyA'] || keyboardState['ArrowLeft']) inputDirection.x -= 1;
        if (keyboardState['KeyD'] || keyboardState['ArrowRight']) inputDirection.x += 1;

        const worldInputDirection = new THREE.Vector3();
        if (inputDirection.lengthSq() > 0) { // Only if there's input
            inputDirection.normalize(); // Ensure consistent speed regardless of diagonal input

            const forwardDirection = new THREE.Vector3();
            camera.getWorldDirection(forwardDirection);
            forwardDirection.y = 0;
            forwardDirection.normalize();

            const sidewaysDirection = new THREE.Vector3();
            sidewaysDirection.crossVectors(camera.up, forwardDirection).normalize();

            // Re-calculating worldInputDirection based on standard camera space interpretation:
            // Z- is forward, X+ is right.
            worldInputDirection.set(0,0,0); // Reset before accumulating
            worldInputDirection.addScaledVector(forwardDirection, -inputDirection.z); // W/S on Z. -inputDirection.z is +1 for W (forward)
            worldInputDirection.addScaledVector(sidewaysDirection, -inputDirection.x);  // A/D on X. sidewaysDirection points left. -inputDirection.x makes A go left, D go right.

            if(worldInputDirection.lengthSq() > 0) worldInputDirection.normalize();
        }

        // Apply acceleration
        const acceleration = worldInputDirection.multiplyScalar(PLAYER_ACCELERATION * deltaTime);
        playerVelocity.add(acceleration);

        // Apply friction
        // Only apply friction if there's no input trying to accelerate in that direction
        // This is a more advanced friction model. A simpler one is to always apply it.
        // For now, let's use a simpler model: always apply friction, acceleration will overpower it.
        playerVelocity.multiplyScalar(Math.exp(-PLAYER_FRICTION * deltaTime));
        if (playerVelocity.lengthSq() < 0.0001) { // Threshold to prevent micro-movements (was 0.01)
            playerVelocity.set(0,0,0);
        }

        // Determine current max speed (sprint or normal)
        const currentMaxSpeed = (keyboardState['ShiftLeft'] || keyboardState['ShiftRight']) 
                                ? playerSpeed * PLAYER_SPRINT_MULTIPLIER 
                                : playerSpeed;

        // Cap speed
        const currentSpeed = playerVelocity.length();
        if (currentSpeed > currentMaxSpeed) {
            playerVelocity.multiplyScalar(currentMaxSpeed / currentSpeed);
        }
    }

    // --- Handle Footstep Sounds ---
    if (audioContext && footstepSoundBuffer && footstepGainNode) {
        const isMovingHorizontally = playerVelocity.x !== 0 || playerVelocity.z !== 0;
        const wantsToMove = (keyboardState['KeyW'] || keyboardState['ArrowUp'] ||
                             keyboardState['KeyS'] || keyboardState['ArrowDown'] ||
                             keyboardState['KeyA'] || keyboardState['ArrowLeft'] ||
                             keyboardState['KeyD'] || keyboardState['ArrowRight']) && controls.isLocked;

        const shouldPlayFootsteps = wantsToMove && isMovingHorizontally;
        const targetPlaybackRate = (keyboardState['ShiftLeft'] || keyboardState['ShiftRight']) 
                                   ? FOOTSTEP_SPRINT_PLAYBACK_RATE 
                                   : FOOTSTEP_BASE_PLAYBACK_RATE;

        if (shouldPlayFootsteps) {
            if (stopFootstepTimeout) {
                clearTimeout(stopFootstepTimeout);
                stopFootstepTimeout = null;
            }

            if (!footstepSourceNode) {
                footstepSourceNode = audioContext.createBufferSource();
                footstepSourceNode.buffer = footstepSoundBuffer;
                footstepSourceNode.loop = true;
                footstepSourceNode.playbackRate.value = targetPlaybackRate;
                footstepSourceNode.connect(footstepGainNode);
                footstepSourceNode.start();
                console.log("Footsteps started");
            } else {
                // Update playback rate if already playing and rate changes
                if (footstepSourceNode.playbackRate.value !== targetPlaybackRate) {
                    footstepSourceNode.playbackRate.setValueAtTime(targetPlaybackRate, audioContext.currentTime);
                }
            }
            // Fade in
            footstepGainNode.gain.cancelScheduledValues(audioContext.currentTime);
            footstepGainNode.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + FOOTSTEP_FADE_DURATION_MS / 1000);

        } else {
            if (footstepSourceNode && footstepGainNode.gain.value > 0) { // If playing or fading in
                // Fade out
                footstepGainNode.gain.cancelScheduledValues(audioContext.currentTime);
                footstepGainNode.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + FOOTSTEP_FADE_DURATION_MS / 1000);
                
                if (!stopFootstepTimeout) { // Schedule stop only if not already scheduled
                    stopFootstepTimeout = setTimeout(() => {
                        if (footstepSourceNode) {
                            footstepSourceNode.stop();
                            footstepSourceNode.disconnect();
                            footstepSourceNode = null;
                            console.log("Footsteps stopped and cleaned up");
                        }
                        stopFootstepTimeout = null; // Clear the timeout ID after execution
                    }, FOOTSTEP_STOP_DELAY_MS);
                }
            }
        }
    }

    // --- Actual Movement Calculation for This Frame ---
    let moveX = 0;
    let moveZ = 0;
    if (controls.isLocked) { // Only calculate horizontal move if locked
      moveX = playerVelocity.x * deltaTime;
      moveZ = playerVelocity.z * deltaTime;
    }

    // Player's current AABB (simplified for XZ plane, centered on camera)
    const playerAABB = new THREE.Box3(
        new THREE.Vector3(camera.position.x - PLAYER_RADIUS, camera.position.y - playerHeight, camera.position.z - PLAYER_RADIUS),
        new THREE.Vector3(camera.position.x + PLAYER_RADIUS, camera.position.y, camera.position.z + PLAYER_RADIUS)
    );

    // Check X-axis movement
    const proposedPlayerAABB_X = playerAABB.clone();
    proposedPlayerAABB_X.min.x += moveX;
    proposedPlayerAABB_X.max.x += moveX;
    let collidedX = false;
    for (const wall of walls) {
        if (proposedPlayerAABB_X.intersectsBox(wall.userData.aabb)) {
            if (moveX > 0) { // Moving right, collided with left face of wall
                camera.position.x = wall.userData.aabb.min.x - PLAYER_RADIUS - 0.001; // Epsilon
            } else if (moveX < 0) { // Moving left, collided with right face of wall
                camera.position.x = wall.userData.aabb.max.x + PLAYER_RADIUS + 0.001; // Epsilon
            }
            playerVelocity.x = 0; // Stop X-axis momentum
            collidedX = true;
            break;
        }
    }
    if (!collidedX) {
        camera.position.x += moveX;
    }

    // Check Z-axis movement (re-evaluate playerAABB for current X before Z check)
    // Update playerAABB to current X position before Z check
    const currentPlayerAABB_ForZ = new THREE.Box3(
        new THREE.Vector3(camera.position.x - PLAYER_RADIUS, camera.position.y - playerHeight, camera.position.z - PLAYER_RADIUS),
        new THREE.Vector3(camera.position.x + PLAYER_RADIUS, camera.position.y, camera.position.z + PLAYER_RADIUS)
    );
    const proposedPlayerAABB_Z = currentPlayerAABB_ForZ.clone();
    proposedPlayerAABB_Z.min.z += moveZ;
    proposedPlayerAABB_Z.max.z += moveZ;
    let collidedZ = false;
    for (const wall of walls) {
        if (proposedPlayerAABB_Z.intersectsBox(wall.userData.aabb)) {
            if (moveZ > 0) { // Moving "down" (positive Z), collided with "upper" face of wall (minZ)
                camera.position.z = wall.userData.aabb.min.z - PLAYER_RADIUS - 0.001; // Epsilon
            } else if (moveZ < 0) { // Moving "up" (negative Z), collided with "lower" face of wall (maxZ)
                camera.position.z = wall.userData.aabb.max.z + PLAYER_RADIUS + 0.001; // Epsilon
            }
            playerVelocity.z = 0; // Stop Z-axis momentum
            collidedZ = true;
            break;
        }
    }
    if (!collidedZ) {
        camera.position.z += moveZ;
    }

    // Check for Power-up Collection - NEW
    if (powerUpSphereMesh && powerUpSphereMesh.visible) {
        const playerAABBForPowerUp = new THREE.Box3(
            new THREE.Vector3(camera.position.x - PLAYER_RADIUS, camera.position.y - playerHeight, camera.position.z - PLAYER_RADIUS),
            new THREE.Vector3(camera.position.x + PLAYER_RADIUS, camera.position.y, camera.position.z + PLAYER_RADIUS)
        );
        if (playerAABBForPowerUp.intersectsBox(powerUpSphereMesh.userData.aabb)) {
            isPowerUpActive = true;
            powerUpRemainingTime = POWERUP_DURATION;
            powerUpSphereMesh.visible = false;
            console.log("Red Power-up collected!");
            
            if (pickupSoundBuffer && audioContext) {
                const source = audioContext.createBufferSource();
                source.buffer = pickupSoundBuffer;
                source.connect(audioContext.destination);
                source.start(0);
            }

            // Deactivate projectile power-up if active
            if (isProjectileEchoPowerUpActive) {
                isProjectileEchoPowerUpActive = false;
                if (projectilePowerUpSphereMesh) projectilePowerUpSphereMesh.visible = true; // Make purple pickup reappear
                console.log("Projectile power-up deactivated by collecting red power-up.");
                stopBeatSound(); // Stop beat sound
            }
        }
    }

    // NEW: Check for Projectile Power-up Collection
    if (projectilePowerUpSphereMesh && projectilePowerUpSphereMesh.visible) {
        // Use a similar AABB for the player
        const playerAABBForProjectilePowerUp = new THREE.Box3(
            new THREE.Vector3(camera.position.x - PLAYER_RADIUS, camera.position.y - playerHeight, camera.position.z - PLAYER_RADIUS),
            new THREE.Vector3(camera.position.x + PLAYER_RADIUS, camera.position.y, camera.position.z + PLAYER_RADIUS)
        );
        if (playerAABBForProjectilePowerUp.intersectsBox(projectilePowerUpSphereMesh.userData.aabb)) {
            isProjectileEchoPowerUpActive = true;
            projectilePowerUpRemainingTime = PROJECTILE_POWERUP_DURATION; // NEW: Set timer
            projectilePowerUpSphereMesh.visible = false;
            console.log("Projectile (Purple) Power-up collected! Duration:", PROJECTILE_POWERUP_DURATION);
            scheduleBeatSoundStart(); // Attempt to start/schedule beat sound

            // Use the same pickup sound as the red sphere
            if (pickupSoundBuffer && audioContext) { // Changed from projectilePickupSoundBuffer
                const source = audioContext.createBufferSource();
                source.buffer = pickupSoundBuffer; // Changed from projectilePickupSoundBuffer
                source.connect(audioContext.destination);
                source.start(0);
            }

            // Deactivate red power-up if active
            if (isPowerUpActive) {
                isPowerUpActive = false;
                powerUpRemainingTime = 0;
                if (powerUpSphereMesh) powerUpSphereMesh.visible = true; // Make red pickup reappear
                console.log("Red power-up deactivated by collecting projectile power-up.");
                // No need to explicitly stop red-powerup specific sounds here, as they are one-shots for echo
            }
        }
    }

    // Apply jump physics
    if (isJumping || playerVerticalVelocity !== 0) { // Player is actively moving vertically (jumping or falling)
        playerVerticalVelocity -= GRAVITY * deltaTime;
        const potentialCameraY = camera.position.y + playerVerticalVelocity * deltaTime;
        const potentialPlayerFeetY = potentialCameraY - playerHeight; // Y-coordinate of player's feet

        let landedOnFloor = false;
        if (playerVerticalVelocity <= 0) { // Only check for landing if moving downwards or at apex
            // AABB for the player's feet at the potential new position (thin box)
            const playerFeetAABB = new THREE.Box3(
                 new THREE.Vector3(camera.position.x - PLAYER_RADIUS, potentialPlayerFeetY - 0.05, camera.position.z - PLAYER_RADIUS), 
                 new THREE.Vector3(camera.position.x + PLAYER_RADIUS, potentialPlayerFeetY + 0.05, camera.position.z + PLAYER_RADIUS)
            );

            for (const floor of floorSegments) {
                if (playerFeetAABB.intersectsBox(floor.userData.aabb)) {
                    camera.position.y = floor.userData.aabb.max.y + playerHeight; // Set camera Y so feet are on floor surface
                    isJumping = false;
                    playerVerticalVelocity = 0;
                    landedOnFloor = true;
                    break;
                }
            }
        }

        if (!landedOnFloor) {
            camera.position.y = potentialCameraY; // Apply the fall/jump movement
        }

    } else { // Player is NOT actively jumping or falling (playerVerticalVelocity is 0)
        // Check if the player is currently standing on a floor segment.
        const currentFeetY = camera.position.y - playerHeight;
        const playerFeetAABB_still = new THREE.Box3(
            new THREE.Vector3(camera.position.x - PLAYER_RADIUS, currentFeetY - 0.05, camera.position.z - PLAYER_RADIUS),
            new THREE.Vector3(camera.position.x + PLAYER_RADIUS, currentFeetY + 0.05, camera.position.z + PLAYER_RADIUS)
        );

        let onGround = false;
        for (const floor of floorSegments) {
            if (playerFeetAABB_still.intersectsBox(floor.userData.aabb)) {
                // Snap camera.position.y to ensure feet are exactly on the floor surface
                camera.position.y = floor.userData.aabb.max.y + playerHeight;
                onGround = true;
                break;
            }
        }
        
        if (!onGround && playerVerticalVelocity <= 0) { // Player is not on any floor segment (e.g., walked off an edge or falling)
            if (!isJumping) { // If not already in a jump (e.g. walked off edge)
              isJumping = true; // Initiate a fall (gravity will take over next frame as playerVerticalVelocity is 0)
            }
        }
    }

    // Basic collision (simple clamping for now, can be improved)
    camera.position.x = Math.max(-24, Math.min(24, camera.position.x));
    camera.position.z = Math.max(-24, Math.min(24, camera.position.z));

    // Keep camera at player height (can be adjusted for jumping/crouching later)
    // camera.position.y = playerHeight; // REMOVED: Now handled by jump physics

    // Check for falling into pit death
    if (camera.position.x > PIT_CENTER_X - PIT_HALF_SIZE && camera.position.x < PIT_CENTER_X + PIT_HALF_SIZE &&
        camera.position.z > PIT_CENTER_Z - PIT_HALF_SIZE && camera.position.z < PIT_CENTER_Z + PIT_HALF_SIZE) {
        if (camera.position.y < DEATH_Y_LEVEL) {
            handlePlayerDeath();
        }
    }

    if (isPlayerDead) {
        renderer.render(scene, camera);
        return; 
    }

    const lifeArray = particleSystem.geometry.attributes.life.array;
    const sizeArray = particleSystem.geometry.attributes.size.array; 
    const colArray = particleSystem.geometry.attributes.color.array; 
    const echoDistanceArray = particleSystem.geometry.attributes.echoDistance.array; // NEW
    
    const currentDynamicFadeDuration = isPowerUpActive ? POWERUP_ECHO_FADE_DURATION : ECHO_FADE_DURATION; // NEW
    const currentEffectiveRaycasterFar = isPowerUpActive ? POWERUP_RAYCASTER_FAR : NORMAL_RAYCASTER_FAR; // NEW for distanceRatio

    let activeParticlesThisFrame = 0;
    let lifeDataChanged = false;
    let sizeDataChanged = false;
    let colorDataChanged = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
        if (lifeArray[i] > 0) {
            activeParticlesThisFrame++;

            const dist = echoDistanceArray[i]; 
            const distanceRatio = Math.min(1.0, dist / currentEffectiveRaycasterFar);
            const invertedDistanceRatio = 1.0 - distanceRatio; 
            const decayMultiplier = 1.0 + (invertedDistanceRatio * DISTANCE_DECAY_RATE_MULTIPLIER); 
            const effectiveDeltaTime = deltaTime * decayMultiplier; 

            const previousLifeForFlag = lifeArray[i]; 
            lifeArray[i] -= effectiveDeltaTime; 
            lifeDataChanged = true; 

            const currentVertexAlpha = colArray[i * 4 + 3];
            const currentSize = sizeArray[i];

            if (lifeArray[i] <= 0) { // DEAD
                if (currentVertexAlpha !== 0.0) {
                    colArray[i * 4 + 3] = 0.0; 
                    colorDataChanged = true; 
                }
                if (currentSize !== 0.0) {
                    sizeArray[i] = 0.0;
                    sizeDataChanged = true;
                }

            } else if (lifeArray[i] <= LIFESTAGE_FADEOUT_THRESHOLD) { // FADE OUT
                let rawProgress = lifeArray[i] / ECHO_FADE_DURATION;
                let effectiveLifeForCurrentFade = rawProgress * currentDynamicFadeDuration;
                const linearFadeOutProgress = Math.min(1.0, Math.max(0, effectiveLifeForCurrentFade / currentDynamicFadeDuration));
                const easedFadeOutProgress = Math.sqrt(Math.max(0, linearFadeOutProgress)); 
                
                if (currentVertexAlpha !== easedFadeOutProgress) {
                    colArray[i * 4 + 3] = easedFadeOutProgress;
                    colorDataChanged = true;
                }
                const newSize = PARTICLE_BASE_SIZE * easedFadeOutProgress;
                if (currentSize !== newSize) {
                    sizeArray[i] = newSize;
                    sizeDataChanged = true;
                }

            } else if (lifeArray[i] <= LIFESTAGE_HOLD_THRESHOLD) { // HOLD
                if (currentVertexAlpha !== 1.0) {
                    colArray[i * 4 + 3] = 1.0; 
                    colorDataChanged = true;
                }
                if (currentSize !== PARTICLE_BASE_SIZE) {
                    sizeArray[i] = PARTICLE_BASE_SIZE;
                    sizeDataChanged = true;
                }

            } else { // FADE IN (lifeArray[i] > LIFESTAGE_HOLD_THRESHOLD up to PARTICLE_INITIAL_LIFE)
                const timeSinceSpawn = PARTICLE_INITIAL_LIFE - lifeArray[i];
                const linearFadeInProgress = Math.min(1.0, timeSinceSpawn / ECHO_FADE_IN_DURATION);
                const easedFadeInProgress = easeOutCubic(linearFadeInProgress);

                if (currentVertexAlpha !== easedFadeInProgress) {
                    colArray[i * 4 + 3] = easedFadeInProgress;
                    colorDataChanged = true;
                }
                const newSize = PARTICLE_BASE_SIZE * easedFadeInProgress;
                if (currentSize !== newSize) {
                    sizeArray[i] = newSize;
                    sizeDataChanged = true;
                }
            }
        }
    }

  /*   // Process Aftershocks
    const currentElapsedTime = clock.elapsedTime;
    const remainingAftershocks = [];
    for (let i = 0; i < activeAftershocks.length; i++) {
        const aftershock = activeAftershocks[i];
        if (currentElapsedTime < aftershock.startTime) {
            remainingAftershocks.push(aftershock); // Not active yet, keep it
            continue;
        }
        if (currentElapsedTime >= aftershock.endTime) {
            // Aftershock is over, don't keep it, and particles return to their base alpha
            // (which they would have from the main lifecycle calculation above if not for the aftershock boost last frame)
            // We might need to re-apply baseAlpha here if aftershock was the *only* thing keeping it visible.
            // For simplicity, if an aftershock ends, the base lifecycle takes over. Any lingering boost is removed.
            // This happens implicitly as the aftershock is no longer processed for these particles.
            continue; 
        }

        const aftershockEffectElapsedTime = currentElapsedTime - aftershock.startTime;
        const aftershockProgress = aftershockEffectElapsedTime / (aftershock.endTime - aftershock.startTime); // Duration is endTime - startTime
        const aftershockIntensity = Math.sin(aftershockProgress * Math.PI); // 0 -> 1 -> 0 curve
        const currentAlphaBoost = aftershock.maxAlphaBoost * aftershockIntensity;

        for (let j = 0; j < aftershock.particleIndices.length; j++) {
            const pIdx = aftershock.particleIndices[j];
            // Retrieve the baseAlpha calculated earlier for this particle for this frame
            // This requires baseAlpha to be calculated and potentially stored or re-calculated before this loop begins for this frame.
            // For now, let's assume colArray[pIdx*4+3] holds the baseAlpha before this aftershock loop begins for this frame.
            const particleBaseAlphaThisFrame = colArray[pIdx * 4 + 3];
            
            let finalAlpha = Math.min(1.0, particleBaseAlphaThisFrame + currentAlphaBoost);
            // If the particle's original life is zero, aftershock shouldn't make it fully visible again
            if (lifeArray[pIdx] <= 0 && particleBaseAlphaThisFrame === 0.0) {
                 finalAlpha = Math.min(1.0, currentAlphaBoost * 0.3); // Much fainter if it was already dead
            }

            if (colArray[pIdx * 4 + 3] !== finalAlpha) {
                colArray[pIdx * 4 + 3] = finalAlpha;
                colorDataChanged = true;
            }
        }
        remainingAftershocks.push(aftershock); // Keep active aftershock
    }
    activeAftershocks = remainingAftershocks; */

    if (lifeDataChanged || sizeDataChanged || colorDataChanged) {
        if (lifeDataChanged) particleSystem.geometry.attributes.life.needsUpdate = true;
        if (sizeDataChanged) particleSystem.geometry.attributes.size.needsUpdate = true;
        if (colorDataChanged) particleSystem.geometry.attributes.color.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

// Animation loop and render function
function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    const deltaTime = clock.getDelta();
    
    // NEW: Clean up any lingering impact flashes
    const currentTime = Date.now();
    for (let i = activeImpactFlashes.length - 1; i >= 0; i--) {
        const flash = activeImpactFlashes[i];
        const flashAge = currentTime - flash.creationTime;
        
        if (flashAge > MAX_FLASH_AGE) {
            if (flash.mesh.parent) {
                scene.remove(flash.mesh);
                console.log("Flash force-removed after maximum age");
            }
            activeImpactFlashes.splice(i, 1);
        }
    }
    
    if (isPlayerDead) {
        renderer.render(scene, camera);
        return;
    }
    
    // Process echo particles progressively
    processEchoParticles();
    
    // Power-up Timer (Red power-up)
    if (isPowerUpActive) {
        powerUpRemainingTime -= deltaTime;
        if (powerUpRemainingTime <= 0) {
            isPowerUpActive = false;
            powerUpRemainingTime = 0;
            if (powerUpSphereMesh) powerUpSphereMesh.visible = true; 
            console.log("Red Power-up expired.");
        }
    }
    // Timer for Projectile Power-up
    if (isProjectileEchoPowerUpActive) {
        projectilePowerUpRemainingTime -= deltaTime;

        // NEW: Spawn door when projectile power-up is active and door isn't already active
        if (!isPuzzleDoorActive && puzzleDoorSpawnLocation) {
            createPuzzleDoor(puzzleDoorSpawnLocation, puzzleDoorSpawnOrientation);
        }

        if (projectilePowerUpRemainingTime <= 0) {
            isProjectileEchoPowerUpActive = false;
            projectilePowerUpRemainingTime = 0;
            stopBeatSound(); // Stop the beat when purple power-up expires
            if (projectilePowerUpSphereMesh) projectilePowerUpSphereMesh.visible = true;
            console.log("Projectile Power-up expired.");

            // NEW: Despawn door if power-up expires and door is not open
            if (isPuzzleDoorActive && !isPuzzleDoorOpen) {
                if (puzzleDoorMesh) scene.remove(puzzleDoorMesh); // This also removes children targets
                // Remove from echoableObjects is a bit more complex, needs careful handling
                // For now, direct removal. Consider a helper for removing door + targets from echoableObjects.
                const doorIndex = echoableObjects.indexOf(puzzleDoorMesh);
                if (doorIndex > -1) echoableObjects.splice(doorIndex, 1);
                const target1Index = echoableObjects.indexOf(puzzleDoorTarget1Mesh);
                if (target1Index > -1) echoableObjects.splice(target1Index, 1);
                const target2Index = echoableObjects.indexOf(puzzleDoorTarget2Mesh);
                if (target2Index > -1) echoableObjects.splice(target2Index, 1);

                puzzleDoorMesh = null; // Clear references
                puzzleDoorTarget1Mesh = null;
                puzzleDoorTarget2Mesh = null;
                isPuzzleDoorActive = false;
                isPuzzleDoorTarget1Hit = false;
                isPuzzleDoorTarget2Hit = false;
                console.log("Puzzle door despawned due to power-up expiry.");
            }
        }
    } else { // If projectile power up is NOT active, ensure beat tracking is reset
        if (beatTrackAudioStartTime !== -1) { // If it was active and now it's not
            stopBeatSound(); // This will reset beatTrackAudioStartTime, etc.
        }
    }

    // Handle movement based on VR state
    if (isInVR) {
        // VR movement using controllers
        handleVRMovement(deltaTime);

                // VR Player enters opened puzzle door
        if (isPuzzleDoorOpen && puzzleDoorSpawnLocation && isPuzzleDoorActive) {
            const vrPlayerPosition = new THREE.Vector3();
            camera.getWorldPosition(vrPlayerPosition); // Get VR headset world position
            const distanceToDoorCenter = vrPlayerPosition.distanceTo(puzzleDoorSpawnLocation);
            if (distanceToDoorCenter < DOOR_WIDTH / 1.8 && Math.abs(vrPlayerPosition.y - (DOOR_HEIGHT / 2)) < DOOR_HEIGHT / 2) {
                console.log("VR Player entered the opened puzzle door!");
                loadNewMaze();
            }
        }
        
        // Update VR debug display if available
        if (vrDebugDisplay && renderer.xr.getSession()) {
            const session = renderer.xr.getSession();
            const inputSources = Array.from(session.inputSources);
            
            // Get gamepad data from controllers
            const leftController = inputSources.find(source => source.handedness === 'left' && source.gamepad);
            const rightController = inputSources.find(source => source.handedness === 'right' && source.gamepad);
            
            const leftAxes = leftController?.gamepad?.axes;
            const rightAxes = rightController?.gamepad?.axes;
            
            // Update the debug display
            vrDebugDisplay.update(leftAxes, rightAxes);
        }
        
        // Update VR mini-map if available
        if (vrMiniMapTexture) {
            updateVRMiniMap();
        }
        

        // Check for power-up collisions in VR
        // Get actual camera/headset position in world space
        const vrCameraPosition = new THREE.Vector3();
        camera.getWorldPosition(vrCameraPosition);
        
        // Collision detection with power-ups in VR
        if (powerUpSphereMesh && powerUpSphereMesh.visible) {
            const distance = vrCameraPosition.distanceTo(powerUpSphereMesh.position);
            if (distance < 1.0) {  // Reasonable collision radius
                isPowerUpActive = true;
                powerUpRemainingTime = POWERUP_DURATION;
                powerUpSphereMesh.visible = false;
                console.log("Power-up activated in VR!");
                if (pickupSoundBuffer && audioContext) {
                    const source = audioContext.createBufferSource();
                    source.buffer = pickupSoundBuffer;
                    source.connect(audioContext.destination);
                    source.start(0);
                }
            }
        }
        
        if (projectilePowerUpSphereMesh && projectilePowerUpSphereMesh.visible) {
            const distance = vrCameraPosition.distanceTo(projectilePowerUpSphereMesh.position);
            if (distance < 1.0) {  // Reasonable collision radius
                isProjectileEchoPowerUpActive = true;
                projectilePowerUpRemainingTime = PROJECTILE_POWERUP_DURATION;
                projectilePowerUpSphereMesh.visible = false;
                console.log("Projectile Power-up activated in VR!");
                scheduleBeatSoundStart(); 
                if (pickupSoundBuffer && audioContext) {
                    const source = audioContext.createBufferSource();
                    source.buffer = pickupSoundBuffer;
                    source.connect(audioContext.destination);
                    source.start(0);
                }
            }
        }

        // NEW: VR Player enters opened puzzle door (within render > if (isInVR) block)
        if (isPuzzleDoorOpen && puzzleDoorSpawnLocation && isPuzzleDoorActive) {
            // vrCameraPosition is already calculated above for power-up checks and should be up-to-date
            const distanceToDoorCenter = vrCameraPosition.distanceTo(puzzleDoorSpawnLocation);
            if (distanceToDoorCenter < DOOR_WIDTH / 1.8 && Math.abs(vrCameraPosition.y - (DOOR_HEIGHT / 2)) < DOOR_HEIGHT / 2) {
                console.log("VR Player entered the opened puzzle door!");
                loadNewMaze();
            }
        }
        // END NEW VR Player enters door

    } else {
        // Regular non-VR controls
        handlePlayerMovement(deltaTime);

        // NEW: Player enters opened puzzle door (within render > else block for non-VR)
        if (isPuzzleDoorOpen && puzzleDoorSpawnLocation && isPuzzleDoorActive) {
            const playerPosition = controls.getObject().position;
            const distanceToDoorCenter = playerPosition.distanceTo(puzzleDoorSpawnLocation);
            if (distanceToDoorCenter < DOOR_WIDTH / 1.8 && Math.abs(playerPosition.y - (DOOR_HEIGHT / 2)) < DOOR_HEIGHT / 2) {
                console.log("Player entered the opened puzzle door!");
                loadNewMaze();
            }
        }
        // END NEW Player enters door
    }
    
    // Projectile Animation and Collision Logic
    if (isProjectileInFlight) {
        let activeProjectiles = 0;
        
        // Process each projectile
        for (let i = 0; i < tossedProjectileMeshes.length; i++) {
            // Skip if this projectile is already dead
            if (projectileCurrentLives[i] <= 0) continue;
            
            // We have at least one active projectile
            activeProjectiles++;
            
            // Update lifetime
            projectileCurrentLives[i] -= deltaTime;
            
            // Apply gravity and move
            tossedProjectileVelocities[i].y -= GRAVITY * deltaTime * 0.5;
            tossedProjectileMeshes[i].position.addScaledVector(tossedProjectileVelocities[i], deltaTime);
            
            // Check for collisions
            const projectileAABB = new THREE.Box3().setFromObject(tossedProjectileMeshes[i]);
            let projectileActuallyHitSomething = false; 
            
            for (const obj of echoableObjects) {
                if (!obj.visible || obj.userData.isPowerUp || obj.userData.isProjectilePowerUp) {
                    continue;
                }

                let hitRegisteredInThisLoopIteration = false;

                // Priority 1: Active Puzzle Door Targets
                if (obj.userData.isDoorTarget && isPuzzleDoorActive && !isPuzzleDoorOpen) {
                    // Ensure the object's world matrix is up to date for accurate AABB calculation.
                    obj.updateMatrixWorld(true); 
                    const targetWorldAABB = new THREE.Box3().setFromObject(obj); // Recalculate AABB in world space on the fly

                    if (targetWorldAABB && projectileAABB.intersectsBox(targetWorldAABB)) { // Use the freshly calculated world AABB
                        console.log("Projectile intersecting with a door target's AABB (recalculated)...");
                        let targetSpecificallyHitThisFrame = false;
                        if (obj.userData.targetId === 1 && !isPuzzleDoorTarget1Hit) {
                            isPuzzleDoorTarget1Hit = true;
                            obj.material.color.set(PUZZLE_DOOR_TARGET_HIT_COLOR);
                            obj.material.emissive.set(PUZZLE_DOOR_TARGET_HIT_COLOR);
                            console.log("Door Target 1 HIT!");
                            targetSpecificallyHitThisFrame = true;
                        } else if (obj.userData.targetId === 2 && !isPuzzleDoorTarget2Hit) {
                            isPuzzleDoorTarget2Hit = true;
                            obj.material.color.set(PUZZLE_DOOR_TARGET_HIT_COLOR);
                            obj.material.emissive.set(PUZZLE_DOOR_TARGET_HIT_COLOR);
                            console.log("Door Target 2 HIT!");
                            targetSpecificallyHitThisFrame = true;
                        }

                        if (targetSpecificallyHitThisFrame) {
                            if (doorTargetHitSoundBuffer && audioContext) {
                                const source = audioContext.createBufferSource();
                                source.buffer = doorTargetHitSoundBuffer;
                                source.connect(audioContext.destination);
                                source.start(0);
                            }
                            const impactPosition = tossedProjectileMeshes[i].position.clone();
                            scene.remove(tossedProjectileMeshes[i]);
                            triggerEcho(impactPosition, PROJECTILE_ECHO_PARTICLE_COLOR);
                            projectileCurrentLives[i] = 0;
                            projectileActuallyHitSomething = true;
                            hitRegisteredInThisLoopIteration = true;
                        }
                    }
                }
                
                // Priority 2: Generic Objects (if no target was hit in this iteration)
                // Also, skip the main door panel if the puzzle is active and the door isn't open yet.
                if (!hitRegisteredInThisLoopIteration) {
                    if (obj === puzzleDoorMesh && isPuzzleDoorActive && !isPuzzleDoorOpen) {
                        // This is the main door panel, puzzle is active & unopen.
                        // We explicitly do nothing here; projectile passes through the panel itself
                        // to allow checks against targets which might be further in echoableObjects list
                        // or if targets were already checked and missed.
                    } else if (obj.userData.aabb && projectileAABB.intersectsBox(obj.userData.aabb)) {
                        // Generic collision with any other object,
                        // OR collision with the puzzleDoorMesh when it's not being skipped (e.g., puzzle inactive or door open).
                        console.log("Projectile collided with a generic object (or inactive/open door panel)!");
                        
                        const impactPosition = tossedProjectileMeshes[i].position.clone();
                        scene.remove(tossedProjectileMeshes[i]);
                        
                        const echoOrigin = impactPosition.clone();
                        echoOrigin.y += 0.1; 
                        
                        console.log("Creating impact flash for generic collision");
                        const impactFlash = new THREE.Mesh(
                            new THREE.SphereGeometry(1.0, 8, 8), 
                            new THREE.MeshBasicMaterial({
                                color: PROJECTILE_ECHO_PARTICLE_COLOR,
                                transparent: true,
                                opacity: 0.7
                            })
                        );
                        impactFlash.position.copy(echoOrigin);
                        scene.add(impactFlash);
                        
                        activeImpactFlashes.push({
                            mesh: impactFlash,
                            creationTime: Date.now()
                        });
                        
                        setTimeout(() => {
                            if (impactFlash.parent) {
                                scene.remove(impactFlash);
                                // console.log("Generic impact flash removed by timeout");
                            }
                        }, 100); 
                        
                        triggerEcho(echoOrigin, PROJECTILE_ECHO_PARTICLE_COLOR);
                        projectileCurrentLives[i] = 0;
                        projectileActuallyHitSomething = true;
                        hitRegisteredInThisLoopIteration = true;
                    }
                }

                if (hitRegisteredInThisLoopIteration) {
                    break; // Projectile hit something, break from 'for (const obj of echoableObjects)'
                }
            } // End for (obj of echoableObjects)
            
            // Handle projectile expiration if it didn't hit anything
            if (!projectileActuallyHitSomething && projectileCurrentLives[i] <= 0) {
                console.log("Projectile lifespan expired.");
                // Ensure mesh is still in scene before trying to remove
                if (tossedProjectileMeshes[i] && tossedProjectileMeshes[i].parent) {
                    scene.remove(tossedProjectileMeshes[i]);
                }
            }
        } // End for (i < tossedProjectileMeshes.length)
    }

    // NEW: Check and Open Puzzle Door if targets are hit
    if (isPuzzleDoorActive && !isPuzzleDoorOpen && isPuzzleDoorTarget1Hit && isPuzzleDoorTarget2Hit) {
        isPuzzleDoorOpen = true;
        console.log("PUZZLE DOOR OPENED!");
        if (puzzleDoorMesh) {
            // "Open" the door - for now, just make it invisible
            // Later, this could be an animation
            puzzleDoorMesh.visible = false;

            // Remove targets from echoable objects as they are no longer interactive
            const target1Index = echoableObjects.indexOf(puzzleDoorTarget1Mesh);
            if (target1Index > -1) echoableObjects.splice(target1Index, 1);
            const target2Index = echoableObjects.indexOf(puzzleDoorTarget2Mesh);
            if (target2Index > -1) echoableObjects.splice(target2Index, 1);
            // The main door mesh might remain echoable if it has physical presence for entering
        }
        if (doorOpenSoundBuffer && audioContext) {
            const source = audioContext.createBufferSource();
            source.buffer = doorOpenSoundBuffer;
            source.connect(audioContext.destination);
            source.start(0);
        }
        // The purple power-up timer (projectilePowerUpRemainingTime) continues. Player has to enter before it runs out.
    }
    // END NEW Puzzle Door Open Logic

    // Particle animation logic 
    const lifeArray = particleSystem.geometry.attributes.life.array;
    const sizeArray = particleSystem.geometry.attributes.size.array; 
    const colArray = particleSystem.geometry.attributes.color.array; 
    const echoDistanceArray = particleSystem.geometry.attributes.echoDistance.array; 
    
    // Select the appropriate fade duration based on echo type
    const currentDynamicFadeDuration = isPowerUpActive ? POWERUP_ECHO_FADE_DURATION : ECHO_FADE_DURATION; 
    const currentEffectiveRaycasterFar = isPowerUpActive ? POWERUP_RAYCASTER_FAR : NORMAL_RAYCASTER_FAR; 

    let activeParticlesThisFrame = 0;
    let lifeDataChanged = false;
    let sizeDataChanged = false;
    let colorDataChanged = false;

    // Calculate base alpha and size from normal lifecycle
    for (let i = 0; i < MAX_PARTICLES; i++) {
        let baseAlpha = 0.0; // Alpha from the particle's own lifecycle
        let baseSize = 0.0;  // Size from the particle's own lifecycle

        if (lifeArray[i] > 0) {
            activeParticlesThisFrame++; // Count active particles for main lifecycle processing

            // Check if this is a purple projectile particle
            const isPurpleParticle = colArray[i * 4 + 0] === PROJECTILE_ECHO_PARTICLE_COLOR.r && 
                                     colArray[i * 4 + 1] === PROJECTILE_ECHO_PARTICLE_COLOR.g && 
                                     colArray[i * 4 + 2] === PROJECTILE_ECHO_PARTICLE_COLOR.b;
            
            // Apply slower decay rate for purple particles
            const dist = echoDistanceArray[i]; 
            const distanceRatio = Math.min(1.0, dist / currentEffectiveRaycasterFar);
            const invertedDistanceRatio = 1.0 - distanceRatio; 
            
            // Reduce decay rate for purple particles so they stay visible longer
            const decayMultiplier = isPurpleParticle
                ? 1.0 + (invertedDistanceRatio * DISTANCE_DECAY_RATE_MULTIPLIER * 0.7) // 30% slower decay for purple 
                : 1.0 + (invertedDistanceRatio * DISTANCE_DECAY_RATE_MULTIPLIER);
                
            const effectiveDeltaTime = deltaTime * decayMultiplier; 

            // Update life
            const previousLifeForFlag = lifeArray[i]; 
            lifeArray[i] -= effectiveDeltaTime; 
            if (lifeArray[i] !== previousLifeForFlag) lifeDataChanged = true;
            
            // Determine baseAlpha and baseSize based on current life
            if (lifeArray[i] <= 0) { // DEAD
                baseAlpha = 0.0;
                baseSize = 0.0;
            } else if (lifeArray[i] <= LIFESTAGE_FADEOUT_THRESHOLD) { // FADE OUT
                let rawProgress = lifeArray[i] / ECHO_FADE_DURATION;
                let effectiveLifeForCurrentFade = rawProgress * currentDynamicFadeDuration;
                const linearFadeOutProgress = Math.min(1.0, Math.max(0, effectiveLifeForCurrentFade / currentDynamicFadeDuration));
                const easedFadeOutProgress = Math.sqrt(Math.max(0, linearFadeOutProgress)); 
                
                // Higher minimum alpha for purple particles during fade out
                if (isPurpleParticle) {
                    baseAlpha = Math.max(0.1, easedFadeOutProgress);
                    baseSize = PARTICLE_BASE_SIZE * 1.5 * easedFadeOutProgress;
                } else {
                    baseAlpha = easedFadeOutProgress;
                    baseSize = PARTICLE_BASE_SIZE * easedFadeOutProgress;
                }
            } else if (lifeArray[i] <= LIFESTAGE_HOLD_THRESHOLD) { // HOLD
                // Brighter hold for purple particles
                if (isPurpleParticle) {
                    baseAlpha = 1.0;
                    baseSize = PARTICLE_BASE_SIZE * 1.5; // Larger size for purple particles
                } else {
                    baseAlpha = 1.0;
                    baseSize = PARTICLE_BASE_SIZE;
                }
            } else { // FADE IN
                const timeSinceSpawn = PARTICLE_INITIAL_LIFE - lifeArray[i];
                const linearFadeInProgress = Math.min(1.0, timeSinceSpawn / ECHO_FADE_IN_DURATION);
                const easedFadeInProgress = easeOutCubic(linearFadeInProgress);

                // Faster fade in for purple particles
                if (isPurpleParticle) {
                    // Purple particles start at 60% alpha (from initialization) and go up to 100%
                    baseAlpha = 0.6 + (easedFadeInProgress * 0.4);
                    baseSize = PARTICLE_BASE_SIZE * 1.5 * easedFadeInProgress;
                } else {
                    baseAlpha = easedFadeInProgress;
                    baseSize = PARTICLE_BASE_SIZE * easedFadeInProgress;
                }
            }
        }

        // Set attributes based on lifecycle
        if (colArray[i * 4 + 3] !== baseAlpha) {
            colArray[i * 4 + 3] = baseAlpha;
            colorDataChanged = true;
        }
        if (sizeArray[i] !== baseSize) {
            sizeArray[i] = baseSize;
            sizeDataChanged = true;
        }
    }

    // REMOVED: Aftershocks processing

    // BPM Visual Pulse is now disabled - we retain the normal sonar pulse behavior for all echo types

    if (lifeDataChanged || sizeDataChanged || colorDataChanged) {
        if (lifeDataChanged) particleSystem.geometry.attributes.life.needsUpdate = true;
        if (sizeDataChanged) particleSystem.geometry.attributes.size.needsUpdate = true;
        if (colorDataChanged) particleSystem.geometry.attributes.color.needsUpdate = true;
    }
    
    // Update mini-map only in non-VR mode
    if (!isInVR) {
        renderMiniMap();
    }
    
    renderer.render(scene, camera);
}

// Start everything
init(); 

// Helper function to create a wall segment
function createWall(x, z, length, orientation, customThickness = WALL_THICKNESS, customHeight = WALL_HEIGHT) {
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222, // Dark grey for walls
        roughness: 0.8,
        metalness: 0.1
    });

    let geometry;
    if (orientation === 'horizontal') { // Wall runs along X axis
        geometry = new THREE.BoxGeometry(length, customHeight, customThickness);
    } else { // Wall runs along Z axis (vertical on map)
        geometry = new THREE.BoxGeometry(customThickness, customHeight, length);
    }

    const wall = new THREE.Mesh(geometry, wallMaterial);
    wall.position.set(x, customHeight / 2, z); // Positioned on the floor

    // Calculate AABB for collision
    const halfSizeX = (orientation === 'horizontal') ? length / 2 : customThickness / 2;
    const halfSizeZ = (orientation === 'vertical') ? length / 2 : customThickness / 2;
    
    wall.userData.aabb = new THREE.Box3(
        new THREE.Vector3(x - halfSizeX, 0, z - halfSizeZ), // Min Y is 0 (floor)
        new THREE.Vector3(x + halfSizeX, customHeight, z + halfSizeZ) // Max Y is wallHeight
    );

    walls.push(wall);
    scene.add(wall);
    echoableObjects.push(wall);
    return wall;
}

function buildMaze() {
    console.log("Building procedural maze...");
    
    // Clear any existing walls
    for (let wall of walls) {
        scene.remove(wall);
        const echoableIndex = echoableObjects.indexOf(wall);
        if (echoableIndex !== -1) {
            echoableObjects.splice(echoableIndex, 1);
        }
    }
    // Clear the array instead of reassigning it
    walls.length = 0;
    
    // Maze parameters
    const mazeSize = 9; // Smaller maze with clearer structure
    const cellSize = 6; // Larger cells for better visibility
    const wallThickness = 1.0; // Thicker walls for better visibility on minimap
    
    // Maze grid: 0 = wall, 1 = path
    const maze = generateMaze(mazeSize);
    
    // Center of the maze in world coordinates
    const mazeOffsetX = -((mazeSize * cellSize) / 2);
    const mazeOffsetZ = -((mazeSize * cellSize) / 2);
    
    // Build the maze walls based on grid
    for (let x = 0; x < mazeSize; x++) {
        for (let z = 0; z < mazeSize; z++) {
            if (maze[x][z] === 0) { // This is a wall cell
                const worldX = mazeOffsetX + x * cellSize + cellSize / 2;
                const worldZ = mazeOffsetZ + z * cellSize + cellSize / 2;
                
                // Create a wall block at this position
                const wall = new THREE.Mesh(
                    new THREE.BoxGeometry(cellSize, WALL_HEIGHT, cellSize),
                    new THREE.MeshStandardMaterial({ 
                        color: 0x222222, // Dark grey for walls
                        roughness: 0.8,
                        metalness: 0.1
                    })
                );
                wall.position.set(worldX, WALL_HEIGHT / 2, worldZ);
                
                // Calculate AABB for collision
                wall.userData.aabb = new THREE.Box3(
                    new THREE.Vector3(worldX - cellSize/2, 0, worldZ - cellSize/2),
                    new THREE.Vector3(worldX + cellSize/2, WALL_HEIGHT, worldZ + cellSize/2)
                );
                
                walls.push(wall);
                scene.add(wall);
                echoableObjects.push(wall);
            }
        }
    }
    
    // Find a path cell for the player to start (using the first path cell)
    let startX, startZ;
    let pathCells = []; // Track all path cells for power-up placement
    
    for (let x = 0; x < mazeSize; x++) {
        for (let z = 0; z < mazeSize; z++) {
            if (maze[x][z] === 1) {
                const worldX = mazeOffsetX + x * cellSize + cellSize / 2;
                const worldZ = mazeOffsetZ + z * cellSize + cellSize / 2;
                
                // Store all path cells for later use
                pathCells.push({x: worldX, z: worldZ, gridX: x, gridZ: z});
                
                // Set the start position to the first path cell found
                if (!startX && !startZ) {
                    startX = worldX;
                    startZ = worldZ;
                }
            }
        }
    }
    
    // Function to check if a cell is far enough from walls
    const isValidPickupLocation = (cell, maze, mazeSize) => {
        const x = cell.gridX;
        const z = cell.gridZ;
        
        // Only check the four immediate adjacent cells (no diagonals)
        // This is less strict than checking all 8 surrounding cells
        const adjacentOffsets = [
            [0, -1], // North
            [1, 0],  // East
            [0, 1],  // South
            [-1, 0]  // West
        ];
        
        // Check if any adjacent cells are walls
        for (const [dx, dz] of adjacentOffsets) {
            const nx = x + dx;
            const nz = z + dz;
            
            // Skip if out of bounds
            if (nx < 0 || nx >= mazeSize || nz < 0 || nz >= mazeSize) continue;
            
            // If adjacent cell is a wall, this location is not valid
            if (maze[nx][nz] === 0) return false;
        }
        
        return true;
    };
    
    // Filter out cells that are too close to walls
    // const validPathCells = pathCells.filter(cell => isValidPickupLocation(cell, maze, mazeSize)); // OLD STRICT FILTER

    // NEW: Temporarily make all pathCells valid to ensure door placement
    const validPathCells = [...pathCells]; 
    
    // Store globally for debugging
    window._debugPathCells = validPathCells;
    
    console.log(`Path cells found: ${pathCells.length}, Valid path cells after filtering: ${validPathCells.length}`);
    if (validPathCells.length === 0 && pathCells.length > 0) {
        console.warn("No valid path cells found after filtering! Maze might be too small or compact.");
        // Log a few path cells for debugging
        pathCells.slice(0, Math.min(3, pathCells.length)).forEach((cell, i) => {
            console.log(`Sample path cell ${i}:`, cell);
        });
    }
    
    // Place power-ups if we have valid cells
    if (validPathCells.length > 5) {
        console.log("Found", validPathCells.length, "valid path cells for power-up placement");
        // Sort cells by distance from start
        validPathCells.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.x - startX, 2) + Math.pow(a.z - startZ, 2));
            const distB = Math.sqrt(Math.pow(b.x - startX, 2) + Math.pow(b.z - startZ, 2));
            return distB - distA; // Descending order to get farthest first
        });
        
        // Ensure we only pick locations that are far enough apart from each other
        const MIN_DISTANCE_BETWEEN_PICKUPS = cellSize * 1.5; // REDUCED: Only 1.5 cells apart instead of 3
        const selectedCells = [];
        
        // Get the first valid cell for red power-up
        selectedCells.push(validPathCells[0]);
        
        // Find a cell for the purple power-up that's far enough from the red one
        let purplePickupCell = null;
        for (let i = 1; i < validPathCells.length; i++) {
            let isFarEnough = true;
            
            // Check distance to all previously selected cells
            for (const selected of selectedCells) {
                const distance = Math.sqrt(
                    Math.pow(validPathCells[i].x - selected.x, 2) + 
                    Math.pow(validPathCells[i].z - selected.z, 2)
                );
                
                if (distance < MIN_DISTANCE_BETWEEN_PICKUPS) {
                    isFarEnough = false;
                    break;
                }
            }
            
            if (isFarEnough) {
                purplePickupCell = validPathCells[i];
                selectedCells.push(purplePickupCell);
                break;
            }
        }
        
        // If we couldn't find a far enough cell, pick the farthest available
        if (!purplePickupCell && validPathCells.length > 1) {
            console.log("Couldn't find a far enough cell for purple pickup, using next available");
            purplePickupCell = validPathCells[1];
            selectedCells.push(purplePickupCell);
        }
        
        // Place red power-up
        if (powerUpSphereMesh && selectedCells.length > 0) {
            const redCell = selectedCells[0];
            powerUpSphereMesh.position.set(
                redCell.x, 
                playerHeight, 
                redCell.z
            );
            powerUpSphereMesh.userData.aabb.setFromObject(powerUpSphereMesh);
            powerUpSphereMesh.visible = true;
            console.log("Red power-up placed at:", redCell, "Position:", powerUpSphereMesh.position);
        } else {
            console.warn("Could not place red power-up:", 
                        powerUpSphereMesh ? "sphere exists" : "sphere missing", 
                        selectedCells.length > 0 ? "cells available" : "no cells available");
        }
        
        // Place projectile power-up
        if (projectilePowerUpSphereMesh && selectedCells.length > 1) {
            const purpleCell = selectedCells[1];
            projectilePowerUpSphereMesh.position.set(
                purpleCell.x, 
                playerHeight, 
                purpleCell.z
            );
            projectilePowerUpSphereMesh.userData.aabb.setFromObject(projectilePowerUpSphereMesh);
            projectilePowerUpSphereMesh.visible = true;
            console.log("Projectile power-up placed at:", purpleCell, "Position:", projectilePowerUpSphereMesh.position);
        } else {
            console.warn("Could not place purple power-up:", 
                        projectilePowerUpSphereMesh ? "sphere exists" : "sphere missing", 
                        selectedCells.length > 1 ? "cells available" : "not enough cells available");
        }
    } else {
        console.warn("Not enough valid path cells for power-up placement. Using fallback positioning.");
        
        // IMPROVED FALLBACK: Better distribute power-ups when limited valid cells
        // Use the available cells but shuffle them first to add randomness
        const cellsToUse = pathCells.length > 1 ? [...pathCells] : [{x: startX, z: startZ}];
        
        // Basic array shuffle (Fisher-Yates algorithm)
        for (let i = cellsToUse.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cellsToUse[i], cellsToUse[j]] = [cellsToUse[j], cellsToUse[i]];
        }
        
        // Place red power-up in a random location that's different from player start if possible
        let redIndex = 0;
        // If more than one cell and the first happens to be player start, use different cell
        if (cellsToUse.length > 1 && 
            Math.abs(cellsToUse[0].x - startX) < 0.1 && 
            Math.abs(cellsToUse[0].z - startZ) < 0.1) {
            redIndex = 1;
        }
        
        // Place purple power-up in a different location if possible
        let purpleIndex = redIndex + 1;
        if (purpleIndex >= cellsToUse.length) purpleIndex = (redIndex === 0) ? 0 : 0;
        
        // Handle the single cell edge case
        const useOffset = cellsToUse.length === 1;
        
        // Place red powerup
        if (powerUpSphereMesh) {
            powerUpSphereMesh.position.set(
                cellsToUse[redIndex].x + (useOffset ? -1.5 : 0), 
                playerHeight, 
                cellsToUse[redIndex].z + (useOffset ? 1.5 : 0)
            );
            powerUpSphereMesh.userData.aabb.setFromObject(powerUpSphereMesh);
            powerUpSphereMesh.visible = true;
            console.log("Red power-up placed at (fallback):", 
                      useOffset ? "offset from" : "", cellsToUse[redIndex], 
                      "Position:", powerUpSphereMesh.position);
        }
        
        // Place purple powerup
        if (projectilePowerUpSphereMesh) {
            projectilePowerUpSphereMesh.position.set(
                cellsToUse[purpleIndex].x + (useOffset ? 1.5 : 0), 
                playerHeight, 
                cellsToUse[purpleIndex].z + (useOffset ? -1.5 : 0)
            );
            projectilePowerUpSphereMesh.userData.aabb.setFromObject(projectilePowerUpSphereMesh);
            projectilePowerUpSphereMesh.visible = true;
            console.log("Purple power-up placed at (fallback):", 
                      useOffset ? "offset from" : "", cellsToUse[purpleIndex], 
                      "Position:", projectilePowerUpSphereMesh.position);
        }
    }
    
    // Set player starting position within the maze - MODIFIED TO PREVENT SPAWNING ON POWER-UPS
    PLAYER_START_X = startX;
    PLAYER_START_Z = startZ;
    
    // Check if player would spawn on red power-up
    if (powerUpSphereMesh && Math.abs(PLAYER_START_X - powerUpSphereMesh.position.x) < 1 && 
        Math.abs(PLAYER_START_Z - powerUpSphereMesh.position.z) < 1) {
        // Add offset to prevent spawning on power-up
        PLAYER_START_X += 2;
        PLAYER_START_Z += 2;
        console.log("Adjusted player start position to avoid spawning on red power-up");
    }
    
    // Check if player would spawn on purple power-up
    if (projectilePowerUpSphereMesh && Math.abs(PLAYER_START_X - projectilePowerUpSphereMesh.position.x) < 1 && 
        Math.abs(PLAYER_START_Z - projectilePowerUpSphereMesh.position.z) < 1) {
        // Add offset to prevent spawning on power-up
        PLAYER_START_X += 2;
        PLAYER_START_Z -= 2;
        console.log("Adjusted player start position to avoid spawning on purple power-up");
    }
    
    camera.position.set(PLAYER_START_X, playerHeight, PLAYER_START_Z);
    
    console.log(`Maze built with ${walls.length} wall segments. Player starting at (${PLAYER_START_X}, ${PLAYER_START_Z}).`);

    // NEW: Determine puzzle door spawn location
    if (validPathCells.length > 2) { // Need at least 3 valid spots for player, 2 powerups, and door
        // Sort by distance from player start (descending)
        validPathCells.sort((a, b) => {
            const distA = Math.hypot(a.x - PLAYER_START_X, a.z - PLAYER_START_Z);
            const distB = Math.hypot(b.x - PLAYER_START_X, b.z - PLAYER_START_Z);
            return distB - distA;
        });

        // Try to find a cell that isn't where power-ups were placed
        let doorCell = null;
        for (const cell of validPathCells) {
            const terlaluDekatDenganRedPowerUp = powerUpSphereMesh && Math.hypot(cell.x - powerUpSphereMesh.position.x, cell.z - powerUpSphereMesh.position.z) < cellSize * 2;
            const terlaluDekatDenganPurplePowerUp = projectilePowerUpSphereMesh && Math.hypot(cell.x - projectilePowerUpSphereMesh.position.x, cell.z - projectilePowerUpSphereMesh.position.z) < cellSize * 2;

            if (!terlaluDekatDenganRedPowerUp && !terlaluDekatDenganPurplePowerUp) {
                doorCell = cell;
                break;
            }
        }
        if (!doorCell) doorCell = validPathCells[0]; // Fallback to farthest if no ideal spot

        puzzleDoorSpawnLocation = new THREE.Vector3(doorCell.x, 0, doorCell.z);

        // Determine orientation (simple logic: if door is more on X-axis end, make it vertical, else horizontal)
        // This is a heuristic and might need refinement based on maze generation
        const mazeHalfWidth = (mazeSize * cellSize) / 2;
        if (Math.abs(doorCell.x) > mazeHalfWidth * 0.7) { // If it's towards the left/right edges
            puzzleDoorSpawnOrientation = 'vertical'; // Wall along Z, door faces along X
        } else {
            puzzleDoorSpawnOrientation = 'horizontal'; // Wall along X, door faces along Z
        }
        console.log("Puzzle door spawn location set:", puzzleDoorSpawnLocation, "Orientation:", puzzleDoorSpawnOrientation);
    } else {
        puzzleDoorSpawnLocation = null; // Not enough spots to place a door
        console.warn("Not enough valid path cells to determine puzzle door spawn location.");
    }
    // END NEW Puzzle Door Location
}

// NEW: Function to create the puzzle door and its targets
function createPuzzleDoor(position, orientation) {
    // Clear existing door parts if any (e.g., from a previous maze)
    if (puzzleDoorMesh) scene.remove(puzzleDoorMesh);
    if (puzzleDoorTarget1Mesh) scene.remove(puzzleDoorTarget1Mesh);
    if (puzzleDoorTarget2Mesh) scene.remove(puzzleDoorTarget2Mesh);

    // Door Panel
    const doorPanelGeometry = new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, DOOR_THICKNESS / 2); // Thinner panel
    const doorPanelMaterial = new THREE.MeshStandardMaterial({ color: PUZZLE_DOOR_PANEL_COLOR, roughness: 0.8, metalness: 0.1 });
    puzzleDoorMesh = new THREE.Mesh(doorPanelGeometry, doorPanelMaterial);
    puzzleDoorMesh.position.copy(position);
    puzzleDoorMesh.position.y = DOOR_HEIGHT / 2; // Sit on the ground

    // Door Frame (simple boxes)
    const frameThickness = DOOR_THICKNESS;
    const frameSideGeometry = new THREE.BoxGeometry(frameThickness, DOOR_HEIGHT, frameThickness);
    const frameTopGeometry = new THREE.BoxGeometry(DOOR_WIDTH + 2 * frameThickness, frameThickness, frameThickness);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: PUZZLE_DOOR_FRAME_COLOR, roughness: 0.7, metalness: 0.1 });

    const frameLeft = new THREE.Mesh(frameSideGeometry, frameMaterial);
    frameLeft.position.set(-DOOR_WIDTH / 2 - frameThickness / 2, 0, 0);
    const frameRight = new THREE.Mesh(frameSideGeometry, frameMaterial);
    frameRight.position.set(DOOR_WIDTH / 2 + frameThickness / 2, 0, 0);
    const frameTop = new THREE.Mesh(frameTopGeometry, frameMaterial);
    frameTop.position.set(0, DOOR_HEIGHT / 2 + frameThickness / 2, 0);

    puzzleDoorMesh.add(frameLeft, frameRight, frameTop); // Add frame parts to the panel mesh for grouping

    // Target 1
    const targetGeometry = new THREE.CylinderGeometry(DOOR_TARGET_RADIUS, DOOR_TARGET_RADIUS, DOOR_TARGET_THICKNESS, 16);
    const target1Material = new THREE.MeshStandardMaterial({ color: PUZZLE_DOOR_TARGET_COLOR, emissive: PUZZLE_DOOR_TARGET_COLOR, emissiveIntensity: 0.5 });
    puzzleDoorTarget1Mesh = new THREE.Mesh(targetGeometry, target1Material);
    puzzleDoorTarget1Mesh.position.set(-DOOR_WIDTH / 4, DOOR_HEIGHT / 3, DOOR_THICKNESS / 4 + 0.01); // Position on the door panel, slightly forward
    puzzleDoorTarget1Mesh.rotation.x = Math.PI / 2; // Lay flat on the door
    puzzleDoorMesh.add(puzzleDoorTarget1Mesh); // Add to door mesh group
    puzzleDoorTarget1Mesh.userData.isDoorTarget = true;
    puzzleDoorTarget1Mesh.userData.targetId = 1;
    puzzleDoorTarget1Mesh.userData.aabb = new THREE.Box3().setFromObject(puzzleDoorTarget1Mesh);

    // Target 2
    const target2Material = new THREE.MeshStandardMaterial({ color: PUZZLE_DOOR_TARGET_COLOR, emissive: PUZZLE_DOOR_TARGET_COLOR, emissiveIntensity: 0.5 });
    puzzleDoorTarget2Mesh = new THREE.Mesh(targetGeometry.clone(), target2Material); // Reuse geometry
    puzzleDoorTarget2Mesh.position.set(DOOR_WIDTH / 4, DOOR_HEIGHT / 3, DOOR_THICKNESS / 4 + 0.01);
    puzzleDoorTarget2Mesh.rotation.x = Math.PI / 2;
    puzzleDoorMesh.add(puzzleDoorTarget2Mesh);
    puzzleDoorTarget2Mesh.userData.isDoorTarget = true;
    puzzleDoorTarget2Mesh.userData.targetId = 2;
    puzzleDoorTarget2Mesh.userData.aabb = new THREE.Box3().setFromObject(puzzleDoorTarget2Mesh);

    // Orientation
    if (orientation === 'vertical') { // Door facing along Z axis
        puzzleDoorMesh.rotation.y = Math.PI / 2;
    }
    // Default is 'horizontal', facing along X, no rotation needed initially for sub-components

    scene.add(puzzleDoorMesh);
    echoableObjects.push(puzzleDoorMesh, puzzleDoorTarget1Mesh, puzzleDoorTarget2Mesh); 

    // Set AABB for the main door for player collision (to pass through when open)
    // This AABB should encompass the entire door structure including frame for echo purposes.
    // For player pass-through logic, we might use a simpler trigger volume or disable collision.
    puzzleDoorMesh.userData.aabb = new THREE.Box3().setFromObject(puzzleDoorMesh);

    isPuzzleDoorActive = true;
    isPuzzleDoorTarget1Hit = false;
    isPuzzleDoorTarget2Hit = false;
    isPuzzleDoorOpen = false;

    console.log("Puzzle door created at:", position, "Orientation:", orientation);
}

// NEW: Function to load a new maze
function loadNewMaze() {
    console.log("Loading new maze...");

    // 1. Stop sounds (optional, depends on what should carry over)
    // stopBeatSound(); // Already handled if power-up expires, but good for explicit reset

    // 2. Reset Player State (minimal reset for now, expand as needed)
    playerVelocity.set(0, 0, 0);
    playerVerticalVelocity = 0;
    isJumping = false;

    // 3. Reset Power-up States
    isPowerUpActive = false;
    powerUpRemainingTime = 0;
    if (powerUpSphereMesh) powerUpSphereMesh.visible = true; // Make it reappear

    isProjectileEchoPowerUpActive = false;
    projectilePowerUpRemainingTime = 0;
    if (projectilePowerUpSphereMesh) projectilePowerUpSphereMesh.visible = true; // Make it reappear
    stopBeatSound(); // Ensure beat sound is stopped

    // 4. Reset and Remove Current Door (if it exists and wasn't cleaned up)
    if (isPuzzleDoorActive || puzzleDoorMesh) {
        if (puzzleDoorMesh && puzzleDoorMesh.parent) scene.remove(puzzleDoorMesh);
        
        // Remove from echoableObjects carefully
        const doorIdx = echoableObjects.indexOf(puzzleDoorMesh);
        if (doorIdx > -1) echoableObjects.splice(doorIdx, 1);
        const target1Idx = echoableObjects.indexOf(puzzleDoorTarget1Mesh);
        if (target1Idx > -1) echoableObjects.splice(target1Idx, 1);
        const target2Idx = echoableObjects.indexOf(puzzleDoorTarget2Mesh);
        if (target2Idx > -1) echoableObjects.splice(target2Idx, 1);

        puzzleDoorMesh = null;
        puzzleDoorTarget1Mesh = null;
        puzzleDoorTarget2Mesh = null;
    }
    isPuzzleDoorActive = false;
    isPuzzleDoorTarget1Hit = false;
    isPuzzleDoorTarget2Hit = false;
    isPuzzleDoorOpen = false;
    puzzleDoorSpawnLocation = null; // Will be reset by buildMaze

    // 5. Clear existing maze elements (buildMaze already does this for walls)
    // If floor or other elements need clearing, do it here.
    // buildMaze() handles clearing and rebuilding walls.

    // 6. Generate new maze layout and elements
    buildMaze(); // This will also set new PLAYER_START_X, PLAYER_START_Z and new puzzleDoorSpawnLocation

    // 7. Reset player position to the new maze's start
    if (controls && controls.isLocked) {
        // Unlock controls to allow teleport-like position update, then re-lock if desired or let player re-engage
        // Forcing position while locked can be janky. Best to move the whole controls object.
        controls.getObject().position.set(PLAYER_START_X, playerHeight, PLAYER_START_Z);
        camera.position.set(PLAYER_START_X, playerHeight, PLAYER_START_Z);
    } else {
        camera.position.set(PLAYER_START_X, playerHeight, PLAYER_START_Z);
        if(controls) controls.getObject().position.copy(camera.position); // Ensure control object is synced
    }
    console.log("Player reset to new maze start:", camera.position);

    // 8. Reset any other relevant game states
    // (e.g., clear pending echoes, projectiles if desired)
    pendingEchoes.length = 0;
    if (particleSystem) {
       // Optionally reset all particles to inactive/offscreen if visual artifacts occur during transition
    }
    tossedProjectileMeshes.forEach(p => scene.remove(p));
    tossedProjectileMeshes.length = 0;
    tossedProjectileVelocities.length = 0;
    projectileCurrentLives.length = 0;
    isProjectileInFlight = false;

    console.log("New maze loaded and player reset.");
}

// Maze generation algorithm (Randomized DFS)
function generateMaze(size) {
    // Initialize grid with all walls
    const grid = Array(size).fill().map(() => Array(size).fill(0));
    
    // Create a grid with cell values
    // 0 = wall, 1 = path
    
    // We'll use odd coordinates for walls and even coordinates for cells
    // Start from a random even coordinate (1, 1) to (size-2, size-2)
    const startX = 1;
    const startZ = 1;
    grid[startX][startZ] = 1; // Mark as path
    
    // Using a stack for depth-first traversal
    const stack = [{x: startX, z: startZ}];
    
    // Possible directions to move in the grid [dx, dz]
    const directions = [
        [0, -2], // North (move 2 cells to skip walls)
        [2, 0],  // East
        [0, 2],  // South
        [-2, 0]  // West
    ];
    
    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        
        // Find unvisited neighbors (must be at least 2 cells away due to walls)
        const unvisitedNeighbors = [];
        
        for (const [dx, dz] of directions) {
            const nx = current.x + dx;
            const nz = current.z + dz;
            
            // Check if this neighbor is valid (in bounds and unvisited)
            if (nx > 0 && nx < size - 1 && nz > 0 && nz < size - 1 && grid[nx][nz] === 0) {
                unvisitedNeighbors.push({x: nx, z: nz, dx: dx/2, dz: dz/2});
            }
        }
        
        if (unvisitedNeighbors.length > 0) {
            // Choose a random unvisited neighbor
            const next = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)];
            
            // Carve a path to this neighbor by marking the wall in between as a path
            grid[current.x + next.dx][current.z + next.dz] = 1;
            
            // Mark the neighbor cell as a path
            grid[next.x][next.z] = 1;
            
            // Add the neighbor to the stack
            stack.push({x: next.x, z: next.z});
        } else {
            // Backtrack if no unvisited neighbors
            stack.pop();
        }
    }
    
    return grid;
}

function handlePlayerDeath() {
    if (isPlayerDead) return; // Already dead, do nothing
    isPlayerDead = true;
    console.log("Player died! Showing death screen...");

    // NEW: Play fall sound on death by falling
    if (fallSoundBuffer && audioContext) {
        if (audioContext.state === 'suspended') { // Good practice to resume if needed
            audioContext.resume();
        }
        const source = audioContext.createBufferSource();
        source.buffer = fallSoundBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        console.log("Playing fall sound on death.");
    }

    stopBeatSound(); // Stop beat sound on death

    if (deathTintElement) deathTintElement.style.display = 'block';
    if (deathMessageElement) deathMessageElement.style.display = 'block';

    // Disable pointer lock controls if active
    if (controls.isLocked) {
        controls.unlock();
    }

    setTimeout(resetPlayerAfterDeath, DEATH_SCREEN_DURATION);
}

function resetPlayerAfterDeath() {
    if (deathTintElement) deathTintElement.style.display = 'none';
    if (deathMessageElement) deathMessageElement.style.display = 'none';

    camera.position.set(PLAYER_START_X, playerHeight, PLAYER_START_Z);
    playerVerticalVelocity = 0;
    isJumping = false;
    isPlayerDead = false;
    console.log("Player reset.");
    stopBeatSound(); // Stop beat sound on reset
    // Player can click to re-lock pointer lock and continue.

    // NEW: Ensure footstep sound is reset/stopped
    if (audioContext && footstepGainNode) {
        footstepGainNode.gain.cancelScheduledValues(audioContext.currentTime);
        footstepGainNode.gain.value = 0; // Hard set to 0
    }
    if (footstepSourceNode) {
        footstepSourceNode.stop();
        footstepSourceNode.disconnect();
        footstepSourceNode = null;
    }
    if (stopFootstepTimeout) {
        clearTimeout(stopFootstepTimeout);
        stopFootstepTimeout = null;
    }
}

function createSegmentedFloorWithPit(totalWidth, totalDepth, pitX, pitZ, pitSize, materialProps) {
    const floorThickness = 0.2;
    const floorY = -floorThickness / 2; // So top surface is at Y=0
    const floorMaterial = new THREE.MeshStandardMaterial(materialProps);

    const pitMinX = pitX - pitSize / 2;
    const pitMaxX = pitX + pitSize / 2;
    const pitMinZ = pitZ - pitSize / 2;
    const pitMaxZ = pitZ + pitSize / 2;

    // Segments (assuming world origin 0,0 is center of totalWidth/totalDepth area for these calculations)
    const worldMinX = -totalWidth / 2;
    const worldMaxX = totalWidth / 2;
    const worldMinZ = -totalDepth / 2;
    const worldMaxZ = totalDepth / 2;

    // 1. Segment above pit (from worldMinZ to pitMinZ)
    if (pitMinZ > worldMinZ) {
        const height1 = pitMinZ - worldMinZ;
        const segment1 = new THREE.Mesh(
            new THREE.BoxGeometry(totalWidth, floorThickness, height1),
            floorMaterial.clone()
        );
        segment1.position.set(0, floorY, worldMinZ + height1 / 2);
        segment1.userData.aabb = new THREE.Box3().setFromObject(segment1); // Add AABB
        scene.add(segment1); floorSegments.push(segment1); echoableObjects.push(segment1);
    }

    // 2. Segment below pit (from pitMaxZ to worldMaxZ)
    if (pitMaxZ < worldMaxZ) {
        const height2 = worldMaxZ - pitMaxZ;
        const segment2 = new THREE.Mesh(
            new THREE.BoxGeometry(totalWidth, floorThickness, height2),
            floorMaterial.clone()
        );
        segment2.position.set(0, floorY, pitMaxZ + height2 / 2);
        segment2.userData.aabb = new THREE.Box3().setFromObject(segment2); // Add AABB
        scene.add(segment2); floorSegments.push(segment2); echoableObjects.push(segment2);
    }

    // 3. Segment left of pit (from pitMinZ to pitMaxZ, from worldMinX to pitMinX)
    if (pitMinX > worldMinX) {
        const width3 = pitMinX - worldMinX;
        const segment3 = new THREE.Mesh(
            new THREE.BoxGeometry(width3, floorThickness, pitSize),
            floorMaterial.clone()
        );
        segment3.position.set(worldMinX + width3 / 2, floorY, pitZ);
        segment3.userData.aabb = new THREE.Box3().setFromObject(segment3); // Add AABB
        scene.add(segment3); floorSegments.push(segment3); echoableObjects.push(segment3);
    }

    // 4. Segment right of pit (from pitMinZ to pitMaxZ, from pitMaxX to worldMaxX)
    if (pitMaxX < worldMaxX) {
        const width4 = worldMaxX - pitMaxX;
        const segment4 = new THREE.Mesh(
            new THREE.BoxGeometry(width4, floorThickness, pitSize),
            floorMaterial.clone()
        );
        segment4.position.set(pitMaxX + width4 / 2, floorY, pitZ);
        segment4.userData.aabb = new THREE.Box3().setFromObject(segment4); // Add AABB
        scene.add(segment4); floorSegments.push(segment4); echoableObjects.push(segment4);
    }
    console.log("Segmented floor with pit created. Segments:", floorSegments.length);
}

// NEW: Function to throw projectile
function throwProjectile() {
    if (!camera) return;
    
    // Check if we've reached the maximum number of projectiles
    if (tossedProjectileMeshes.length >= MAX_PROJECTILES) {
        // Find any dead projectiles and remove them
        for (let i = tossedProjectileMeshes.length - 1; i >= 0; i--) {
            if (projectileCurrentLives[i] <= 0) {
                scene.remove(tossedProjectileMeshes[i]);
                tossedProjectileMeshes.splice(i, 1);
                tossedProjectileVelocities.splice(i, 1);
                projectileCurrentLives.splice(i, 1);
            }
        }
        
        // If still at max capacity, return
        if (tossedProjectileMeshes.length >= MAX_PROJECTILES) {
            console.log(`Maximum projectiles (${MAX_PROJECTILES}) already in flight.`);
            return;
        }
    }
    
    // Create a new projectile
    const tossedProjectileGeom = new THREE.SphereGeometry(0.1, 8, 8);
    const tossedProjectileMat = new THREE.MeshStandardMaterial({ 
        color: PROJECTILE_ECHO_PARTICLE_COLOR,
        emissive: PROJECTILE_ECHO_PARTICLE_COLOR,
        emissiveIntensity: 0.7
    });
    const newProjectile = new THREE.Mesh(tossedProjectileGeom, tossedProjectileMat);
    
    // Set projectile start position
    newProjectile.position.copy(camera.position);
    // Offset slightly in front of camera so it doesn't spawn inside player
    const offsetDirection = new THREE.Vector3();
    camera.getWorldDirection(offsetDirection);
    newProjectile.position.addScaledVector(offsetDirection, 0.5);
    
    // Add to scene
    scene.add(newProjectile);
    
    // Set velocity
    const newVelocity = new THREE.Vector3();
    camera.getWorldDirection(newVelocity);
    newVelocity.multiplyScalar(PROJECTILE_SPEED);
    
    // Add to arrays
    tossedProjectileMeshes.push(newProjectile);
    tossedProjectileVelocities.push(newVelocity);
    projectileCurrentLives.push(PROJECTILE_MAX_LIFE);
    
    // Set flag
    isProjectileInFlight = true;
    
    console.log(`Projectile thrown! Total projectiles in flight: ${tossedProjectileMeshes.length}`);
}

function renderMiniMap() {
    if (!miniMapContext || !miniMapCanvas) return;

    // Clear the mini-map
    miniMapContext.fillStyle = 'rgba(0, 0, 0, 0.7)';
    miniMapContext.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
    
    const mapWidth = miniMapCanvas.width;
    const mapHeight = miniMapCanvas.height;
    const centerX = mapWidth / 2;
    const centerZ = mapHeight / 2;

    // Draw the floor for reference (dark gray)
    miniMapContext.fillStyle = 'rgba(50, 50, 50, 0.5)';
    for (const floor of floorSegments) {
        if (floor.userData && floor.userData.aabb) {
            const aabb = floor.userData.aabb;
            const mapX = centerX + aabb.min.x * miniMapScale;
            const mapZ = centerZ + aabb.min.z * miniMapScale;
            const width = (aabb.max.x - aabb.min.x) * miniMapScale;
            const height = (aabb.max.z - aabb.min.z) * miniMapScale;
            miniMapContext.fillRect(mapX, mapZ, width, height);
        }
    }

    // Draw the maze walls (light gray)
    miniMapContext.fillStyle = 'rgba(200, 200, 200, 0.9)';
    for (const wall of walls) {
        if (wall.userData && wall.userData.aabb) {
            const aabb = wall.userData.aabb;
            const mapX = centerX + aabb.min.x * miniMapScale;
            const mapZ = centerZ + aabb.min.z * miniMapScale;
            const width = (aabb.max.x - aabb.min.x) * miniMapScale;
            const height = (aabb.max.z - aabb.min.z) * miniMapScale;
            miniMapContext.fillRect(mapX, mapZ, width, height);
        }
    }

    // DEBUGGING: Draw indicators for all valid path cells
    if (window._debugPathCells && window._debugPathCells.length > 0) {
        miniMapContext.fillStyle = 'rgba(255, 255, 0, 0.5)'; // Yellow for debug path cells
        for (const cell of window._debugPathCells) {
            const cellX = centerX + cell.x * miniMapScale;
            const cellZ = centerZ + cell.z * miniMapScale;
            miniMapContext.beginPath();
            miniMapContext.arc(cellX, cellZ, 3, 0, Math.PI * 2);
            miniMapContext.fill();
        }
    }

    // Draw power-up locations if visible
    if (powerUpSphereMesh && powerUpSphereMesh.visible) {
        miniMapContext.fillStyle = 'rgba(255, 0, 0, 1.0)'; // Brighter red for better visibility
        const powerUpX = centerX + powerUpSphereMesh.position.x * miniMapScale;
        const powerUpZ = centerZ + powerUpSphereMesh.position.z * miniMapScale;
        miniMapContext.beginPath();
        miniMapContext.arc(powerUpX, powerUpZ, 6, 0, Math.PI * 2);
        miniMapContext.fill();
    }

    if (projectilePowerUpSphereMesh && projectilePowerUpSphereMesh.visible) {
        miniMapContext.fillStyle = 'rgba(180, 0, 255, 1.0)'; // Brighter purple for better visibility
        const projectilePowerUpX = centerX + projectilePowerUpSphereMesh.position.x * miniMapScale;
        const projectilePowerUpZ = centerZ + projectilePowerUpSphereMesh.position.z * miniMapScale;
        miniMapContext.beginPath();
        miniMapContext.arc(projectilePowerUpX, projectilePowerUpZ, 6, 0, Math.PI * 2);
        miniMapContext.fill();
    }
    
    // Draw puzzle door if active and exists
    if (isPuzzleDoorActive && puzzleDoorMesh) { 
        if (puzzleDoorMesh.visible) { // Only draw panel if it's visible
            miniMapContext.fillStyle = 'rgba(150, 75, 0, 0.8)'; // Brownish for door panel
            const doorAABB = puzzleDoorMesh.userData.aabb; // Assuming AABB is in world space or accurately reflects world position/size
            if (doorAABB) {
                // Convert AABB center and size to map coordinates
                const doorCenterX = centerX + puzzleDoorMesh.position.x * miniMapScale;
                const doorCenterZ = centerZ + puzzleDoorMesh.position.z * miniMapScale;
                const doorWidthOnMap = (puzzleDoorMesh.rotation.y === Math.PI / 2 ? DOOR_THICKNESS : DOOR_WIDTH) * miniMapScale;
                const doorHeightOnMap = (puzzleDoorMesh.rotation.y === Math.PI / 2 ? DOOR_WIDTH : DOOR_THICKNESS) * miniMapScale; 
                
                miniMapContext.save();
                miniMapContext.translate(doorCenterX, doorCenterZ);
                miniMapContext.rotate(puzzleDoorMesh.rotation.y); // Align with door's rotation
                miniMapContext.fillRect(-doorWidthOnMap / 2, -doorHeightOnMap / 2, doorWidthOnMap, doorHeightOnMap);
                miniMapContext.restore();
            }
        }

        // Draw targets if they exist and door is not yet open (and puzzle is active)
        if (!isPuzzleDoorOpen) {
            const targetRadiusOnMap = Math.max(1, 2 * miniMapScale * DOOR_TARGET_RADIUS); // Ensure minimum 1px radius
            if (puzzleDoorTarget1Mesh && puzzleDoorTarget1Mesh.visible) {
                miniMapContext.fillStyle = isPuzzleDoorTarget1Hit ? 'rgba(255, 255, 0, 1.0)' : 'rgba(0, 255, 0, 1.0)';
                const target1WorldPos = new THREE.Vector3();
                puzzleDoorTarget1Mesh.getWorldPosition(target1WorldPos);
                const target1X = centerX + target1WorldPos.x * miniMapScale;
                const target1Z = centerZ + target1WorldPos.z * miniMapScale;
                miniMapContext.beginPath();
                miniMapContext.arc(target1X, target1Z, targetRadiusOnMap, 0, Math.PI * 2);
                miniMapContext.fill();
            }
            if (puzzleDoorTarget2Mesh && puzzleDoorTarget2Mesh.visible) {
                miniMapContext.fillStyle = isPuzzleDoorTarget2Hit ? 'rgba(255, 255, 0, 1.0)' : 'rgba(0, 255, 0, 1.0)';
                const target2WorldPos = new THREE.Vector3();
                puzzleDoorTarget2Mesh.getWorldPosition(target2WorldPos);
                const target2X = centerX + target2WorldPos.x * miniMapScale;
                const target2Z = centerZ + target2WorldPos.z * miniMapScale;
                miniMapContext.beginPath();
                miniMapContext.arc(target2X, target2Z, targetRadiusOnMap, 0, Math.PI * 2);
                miniMapContext.fill();
            }
        }
    }
    
    // Draw player position (cyan circle with direction indicator)
    if (camera) {
        const playerX = centerX + camera.position.x * miniMapScale;
        const playerZ = centerZ + camera.position.z * miniMapScale;
        
        // Draw player direction indicator first (behind the player dot)
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.normalize();
        
        miniMapContext.strokeStyle = 'rgba(0, 255, 255, 0.9)';
        miniMapContext.lineWidth = 2;
        miniMapContext.beginPath();
        miniMapContext.moveTo(playerX, playerZ);
        miniMapContext.lineTo(
            playerX + direction.x * 15,
            playerZ + direction.z * 15
        );
        miniMapContext.stroke();
        
        // Draw player circle on top
        miniMapContext.fillStyle = 'rgba(0, 255, 255, 1.0)';
        miniMapContext.beginPath();
        miniMapContext.arc(playerX, playerZ, 5, 0, Math.PI * 2);
        miniMapContext.fill();
    }
    
    // Draw border around minimap
    miniMapContext.strokeStyle = 'rgba(0, 255, 255, 0.7)';
    miniMapContext.lineWidth = 2;
    miniMapContext.strokeRect(0, 0, mapWidth, mapHeight);
} 

// New function to handle VR controller interactions
function setupVRControllers() {
    // Controller 1 (typically left hand)
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    controller1.addEventListener('squeezestart', onSqueezeStart);
    controller1.addEventListener('squeezeend', onSqueezeEnd);
    controller1.addEventListener('connected', (event) => {
        console.log('Controller 1 connected:', event.data);
        controller1.gamepad = event.data.gamepad;
    });
    controller1.addEventListener('disconnected', () => { 
        console.log('Controller 1 disconnected');
        controller1.gamepad = null;
    });
    scene.add(controller1);

    // Controller 2 (typically right hand)
    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    controller2.addEventListener('squeezestart', onSqueezeStart);
    controller2.addEventListener('squeezeend', onSqueezeEnd);
    controller2.addEventListener('connected', (event) => {
        console.log('Controller 2 connected:', event.data);
        controller2.gamepad = event.data.gamepad;
    });
    controller2.addEventListener('disconnected', () => { 
        console.log('Controller 2 disconnected');
        controller2.gamepad = null;
    });
    scene.add(controller2);

    // Controller grips/models
    const controllerModelFactory = new XRControllerModelFactory();

    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    scene.add(controllerGrip1);

    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    scene.add(controllerGrip2);
    
    // Add visible rays to controllers
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]);
    geometry.scale(0, 0, -10); // 10 meters long ray

    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        linewidth: 3 // Note: linewidth only works in WebGL 2
    });

    const line = new THREE.Line(geometry, lineMaterial);
    line.name = 'line';
    line.scale.z = 5;

    controller1.add(line.clone());
    controller2.add(line.clone());
    
    // Set initial visibility based on VR state
    controller1.visible = false;
    controller2.visible = false;
    controllerGrip1.visible = false;
    controllerGrip2.visible = false;
}

// Additional controller event handlers
function onSelectStart(event) {
    // Get the controller from the event
    const controller = event.target;
    
    // Log controller event for debugging
    console.log("Select start event on controller:", 
                controller === controller1 ? "1 (left?)" : "2 (right?)");
    
    if (isProjectileEchoPowerUpActive) {
        // Throw projectile when the trigger is pressed in VR
        throwProjectileVR(controller);
    } else {
        // Test reference space movement
        if (controller === controller2) { // Right controller
            const moved = updateReferenceSpace();
            if (moved) {
                console.log("Moved using reference space!");
            }
        }
        
        // Trigger a regular echo
        const controllerPosition = new THREE.Vector3();
        controller.getWorldPosition(controllerPosition);
        
        // Log echo position
        console.log("Triggering echo at position:", 
                   controllerPosition.x.toFixed(2), 
                   controllerPosition.y.toFixed(2), 
                   controllerPosition.z.toFixed(2));
                   
        triggerEcho(controllerPosition);
    }
}

function throwProjectileVR(controller) {
    if (!isProjectileEchoPowerUpActive) return;
    
    // Check if we've reached the maximum number of projectiles
    if (tossedProjectileMeshes.length >= MAX_PROJECTILES) {
        // Find any dead projectiles and remove them
        for (let i = tossedProjectileMeshes.length - 1; i >= 0; i--) {
            if (projectileCurrentLives[i] <= 0) {
                scene.remove(tossedProjectileMeshes[i]);
                tossedProjectileMeshes.splice(i, 1);
                tossedProjectileVelocities.splice(i, 1);
                projectileCurrentLives.splice(i, 1);
            }
        }
        
        // If still at max capacity, return
        if (tossedProjectileMeshes.length >= MAX_PROJECTILES) {
            console.log(`Maximum projectiles (${MAX_PROJECTILES}) already in flight.`);
            return;
        }
    }
    
    // Get controller position and orientation
    const controllerPosition = new THREE.Vector3();
    controller.getWorldPosition(controllerPosition);
    
    // Create a direction vector pointing where the controller is pointing
    const controllerDirection = new THREE.Vector3(0, 0, -1);
    controllerDirection.applyQuaternion(controller.quaternion);
    controllerDirection.normalize();
    
    // Create projectile at the controller's position
    const projectileGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: PROJECTILE_ECHO_PARTICLE_COLOR });
    const newProjectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    newProjectile.position.copy(controllerPosition);
    scene.add(newProjectile);
    
    // Set velocity in the controller's forward direction
    const newVelocity = controllerDirection.clone().multiplyScalar(PROJECTILE_SPEED);
    
    // Add to arrays
    tossedProjectileMeshes.push(newProjectile);
    tossedProjectileVelocities.push(newVelocity);
    projectileCurrentLives.push(PROJECTILE_MAX_LIFE);
    
    // Set flag
    isProjectileInFlight = true;
    
    // Sound effect if available
    // playProjectileEchoSound(); // Uncomment if this function exists
    
    console.log(`VR Projectile thrown! Total projectiles in flight: ${tossedProjectileMeshes.length}`);
}

function onSelectEnd(event) {
    // Handle releasing the trigger/select button
    // Nothing needed for echo effect
}

// Add VR session change handler
function onVRSessionChange(session) {
    isInVR = !!session;
    console.log("VR session changed:", isInVR ? "Entered VR" : "Exited VR");
    
    // Show/hide controllers based on VR state
    if (controller1 && controller2) {
        controller1.visible = isInVR;
        controller2.visible = isInVR;
        controllerGrip1.visible = isInVR;
        controllerGrip2.visible = isInVR;
        
        // Debug controller state when entering VR
        if (isInVR) {
            console.log("Controllers visible. Checking input sources...");
            
            // Create debug display when entering VR
            vrDebugDisplay = createVRDebugDisplay();
            
            // Create VR mini-map
            createVRMiniMap();
            
            // Check input sources after a short delay to ensure they're initialized
            setTimeout(() => {
                if (session) {
                    const inputSources = Array.from(session.inputSources);
                    console.log(`Found ${inputSources.length} input sources`);
                    
                    inputSources.forEach((source, i) => {
                        console.log(`Input source ${i}:`);
                        console.log(`- Handedness: ${source.handedness}`);
                        console.log(`- Has gamepad: ${!!source.gamepad}`);
                        if (source.gamepad) {
                            console.log(`- Axes count: ${source.gamepad.axes.length}`);
                            console.log(`- Buttons count: ${source.gamepad.buttons.length}`);
                        }
                    });
                }
            }, 1000);
        } else {
            // Clean up debug display when exiting VR
            vrDebugDisplay = null;
            vrMiniMap = null;
        }
    }
    
    // Handle other VR-specific adjustments
    if (isInVR) {
        // Disable pointer lock controls in VR
        if (controls && controls.isLocked) {
            controls.unlock();
        }
        
        // Place player at starting position in VR
        camera.position.set(PLAYER_START_X, playerHeight, PLAYER_START_Z);
        
        // Hide reticle in VR
        if (reticle) reticle.style.display = 'none';
        
        // Hide mini-map in VR (optional, you might want to implement a different way to show it)
        if (miniMapCanvas) miniMapCanvas.style.display = 'none';
    } else {
        // Re-enable mouse look when exiting VR
        if (reticle) reticle.style.display = 'block';
        if (miniMapCanvas) miniMapCanvas.style.display = 'block';
        
        // Re-enable controls for desktop mode
        setupControls();
    }
}

// ... existing code ...

// Additional controller event handlers
function onSqueezeStart(event) {
    // Handle grip button press (could be used for teleport mode toggle, etc.)
    console.log('Squeeze start', event.target === controller1 ? 'left' : 'right');
}

function onSqueezeEnd(event) {
    // Handle grip button release
    console.log('Squeeze end', event.target === controller1 ? 'left' : 'right');
}

// Handle VR movement
function handleVRMovement(deltaTime) {
    if (!isInVR) return;
    
    try {
        // Get the XR session
        const session = renderer.xr.getSession();
        if (!session) {
            return;
        }
        
        // Get input sources and their gamepad data
        const inputSources = Array.from(session.inputSources);
        
        // Find the left controller for movement
        const leftController = inputSources.find(source => 
            source.handedness === 'left' && source.gamepad);
        
        if (!leftController || !leftController.gamepad) {
            return; // No left controller with gamepad found
        }
        
        const gamepad = leftController.gamepad;
        
        // Based on your debug, Quest 2 left thumbstick uses axes[2] for X and axes[3] for Y
        let axisX = 0;
        let axisY = 0;
        
        if (gamepad.axes.length >= 4) {
            axisX = gamepad.axes[2]; 
            axisY = gamepad.axes[3];
            
            // Only continue if there's significant input
            if (Math.abs(axisX) < 0.2 && Math.abs(axisY) < 0.2) {
                return;
            }
            
            // Don't invert Y axis as requested by user
            // axisY = -axisY; // This line is removed to not invert the Y axis
            
            // Debug on significant input
            console.log(`Left stick input: X=${axisX.toFixed(2)}, Y=${axisY.toFixed(2)}`);
            
            // Try moving with reference space first (more reliable method on Quest)
            const movedWithReferenceSpace = movePlayerWithReferenceSpace(axisX, axisY, deltaTime);
            
            // If reference space movement failed, fall back to camera rig movement
            if (!movedWithReferenceSpace) {
                // Get the camera and rig
                const xrCamera = renderer.xr.getCamera();
                if (!xrCamera) {
                    return;
                }
                
                const cameraRig = xrCamera.parent;
                if (!cameraRig) {
                    console.log("No camera rig found!");
                    return;
                }
                
                // Get movement direction based on headset orientation
                const headsetDirection = new THREE.Vector3(0, 0, -1); // Forward
                headsetDirection.applyQuaternion(xrCamera.quaternion);
                headsetDirection.y = 0; // Keep movement horizontal
                headsetDirection.normalize();
                
                const rightDirection = new THREE.Vector3(1, 0, 0); // Right
                rightDirection.applyQuaternion(xrCamera.quaternion);
                rightDirection.y = 0;
                rightDirection.normalize();
                
                // Calculate movement vector
                const movement = new THREE.Vector3();
                
                // Apply forward/backward movement (using Y axis)
                if (Math.abs(axisY) > 0.2) {
                    const forwardMagnitude = axisY * VR_MOVE_SPEED * deltaTime * 1.5; // Reduced speed multiplier
                    movement.addScaledVector(headsetDirection, forwardMagnitude);
                }
                
                // Apply left/right movement (using X axis)
                if (Math.abs(axisX) > 0.2) {
                    const rightMagnitude = -axisX * VR_MOVE_SPEED * deltaTime * 1.5; // Negative sign to invert X axis
                    movement.addScaledVector(rightDirection, rightMagnitude);
                }
                
                // If we have movement to apply
                if (movement.lengthSq() > 0) {
                    // Apply movement to the camera rig
                    cameraRig.position.add(movement);
                    console.log("Camera rig movement:", movement.x.toFixed(2), movement.z.toFixed(2));
                    
                    // Create a red marker at current position for debugging
                    if (Math.abs(axisX) > 0.7 || Math.abs(axisY) > 0.7) {
                        const marker = new THREE.Mesh(
                            new THREE.SphereGeometry(0.05),
                            new THREE.MeshBasicMaterial({color: 0xff0000})
                        );
                        marker.position.copy(cameraRig.position);
                        marker.position.y = 0; // Place on the ground
                        scene.add(marker);
                        
                        // Remove marker after 2 seconds
                        setTimeout(() => {
                            scene.remove(marker);
                        }, 2000);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error in handleVRMovement:", error);
    }
}

// Add a simpler setup for controllers function
function setupControls() {
    if (controls) {
        controls.addEventListener('lock', () => {
            console.log('Pointer locked');
            if (reticle) reticle.style.display = 'block';
        });
        
        controls.addEventListener('unlock', () => {
            console.log('Pointer unlocked');
            if (reticle) reticle.style.display = 'none';
        });
    } else {
        console.warn("Controls not available for setup");
    }
}

// Add a function to create visual debug for VR controller input
function createVRDebugDisplay() {
    // Create a simple canvas for debugging
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = 256;
    debugCanvas.height = 128;
    debugCanvas.style.position = 'absolute';
    debugCanvas.style.bottom = '10px';
    debugCanvas.style.left = '10px';
    debugCanvas.style.zIndex = '100';
    debugCanvas.style.background = 'rgba(0,0,0,0.5)';
    document.body.appendChild(debugCanvas);
    
    const ctx = debugCanvas.getContext('2d');
    
    // Create a texture from this canvas
    const debugTexture = new THREE.CanvasTexture(debugCanvas);
    
    // Create a plane to display the debug info in VR
    const debugPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.1),
        new THREE.MeshBasicMaterial({ 
            map: debugTexture,
            transparent: true,
            opacity: 0.8
        })
    );
    
    // Attach to the left controller
    if (controller1) {
        controller1.add(debugPlane);
        // Position it above the controller
        debugPlane.position.set(0, 0.1, -0.05);
        debugPlane.rotation.x = -Math.PI / 4; // Tilt for better visibility
    }
    
    // Function to update the debug display
    function updateDebugDisplay(leftAxes, rightAxes) {
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
        
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
        
        // Draw title
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText('Controller Input Debug', 10, 20);
        
        // Left controller axes
        ctx.fillStyle = 'cyan';
        ctx.fillText('Left: ' + (leftAxes ? `X: ${leftAxes[2].toFixed(2)}, Y: ${leftAxes[3].toFixed(2)}` : 'N/A'), 10, 50);
        
        // Right controller axes
        ctx.fillStyle = 'yellow';
        ctx.fillText('Right: ' + (rightAxes ? `X: ${rightAxes[0].toFixed(2)}, Y: ${rightAxes[1].toFixed(2)}` : 'N/A'), 10, 80);
        
        // Update the texture
        debugTexture.needsUpdate = true;
    }
    
    return {
        update: updateDebugDisplay,
        plane: debugPlane
    };
}

// Variable to hold debug display
let vrDebugDisplay = null;

// Create a function to try moving using the XR reference space directly
function updateReferenceSpace() {
    if (!isInVR || !renderer.xr.isPresenting) return;
    
    try {
        const referenceSpace = renderer.xr.getReferenceSpace();
        if (!referenceSpace) {
            console.log("No reference space available");
            return false;
        }
        
        console.log("Found reference space:", referenceSpace.type);
        
        // Create transform for the offset
        const transform = new XRRigidTransform(
            {x: 0, y: 0, z: -0.1}, // Move forward 10cm (hardcoded test)
            {x: 0, y: 0, z: 0, w: 1}
        );
        
        // Get a new offset reference space
        const newReferenceSpace = referenceSpace.getOffsetReferenceSpace(transform);
        
        // Update the reference space
        renderer.xr.setReferenceSpace(newReferenceSpace);
        
        console.log("Successfully updated reference space");
        return true;
    } catch (error) {
        console.error("Error updating reference space:", error);
        return false;
    }
}

// Create a function to directly move the player using reference space in VR based on controller input
function movePlayerWithReferenceSpace(xAxis, yAxis, deltaTime) {
    if (!isInVR || !renderer.xr.isPresenting) return false;
    
    try {
        const referenceSpace = renderer.xr.getReferenceSpace();
        if (!referenceSpace) {
            return false;
        }
        
        // Get the camera to determine forward direction
        const xrCamera = renderer.xr.getCamera();
        
        // Get forward and right vectors from camera orientation
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(xrCamera.quaternion);
        forward.y = 0; // Keep movement horizontal
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(xrCamera.quaternion);
        right.y = 0;
        right.normalize();
        
        // Calculate movement vector
        const moveVector = new THREE.Vector3();
        
        // Apply input (yAxis for forward/back, xAxis for left/right)
        // Note: we're NOT inverting Y axis now as requested by user
        if (Math.abs(yAxis) > 0.2) {
            moveVector.addScaledVector(forward, yAxis * VR_MOVE_SPEED * deltaTime);
        }
        
        // Fix X-axis: Invert X for correct left/right movement
        if (Math.abs(xAxis) > 0.2) {
            moveVector.addScaledVector(right, -xAxis * VR_MOVE_SPEED * deltaTime); // Negative sign to invert X axis
        }
        
        // Apply a moderate multiplier for more noticeable movement
        moveVector.multiplyScalar(2.0); // Reduced from 10 to 2
        
        if (moveVector.lengthSq() > 0) {
            // Create XRRigidTransform for movement
            const transform = new XRRigidTransform(
                {x: moveVector.x, y: 0, z: moveVector.z},
                {x: 0, y: 0, z: 0, w: 1}
            );
            
            // Get new reference space with offset
            const newReferenceSpace = referenceSpace.getOffsetReferenceSpace(transform);
            
            // Update the reference space
            renderer.xr.setReferenceSpace(newReferenceSpace);
            
            // Log movement occasionally but not for every minor movement
            if (moveVector.length() > 0.05) {
                console.log("Reference space movement:", moveVector.x.toFixed(2), moveVector.z.toFixed(2));
            }
            
            // Drop a marker to visualize movement (only on significant movement)
            if (Math.abs(xAxis) > 0.7 || Math.abs(yAxis) > 0.7) {
                const marker = new THREE.Mesh(
                    new THREE.SphereGeometry(0.05),
                    new THREE.MeshBasicMaterial({color: 0x00ff00}) // Green for reference space movement
                );
                
                // Get the current camera position to place the marker
                const position = new THREE.Vector3();
                xrCamera.getWorldPosition(position);
                
                marker.position.copy(position);
                marker.position.y = 0; // Place on the ground
                
                scene.add(marker);
                
                // Remove marker after 2 seconds
                setTimeout(() => {
                    scene.remove(marker);
                }, 2000);
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("Error moving with reference space:", error);
        return false;
    }
}

// Add VR mini-map functionality
let vrMiniMap = null;
let vrMiniMapCanvas = null;
let vrMiniMapTexture = null;

function createVRMiniMap() {
    // Create a canvas for the VR mini-map
    vrMiniMapCanvas = document.createElement('canvas');
    vrMiniMapCanvas.width = 256;
    vrMiniMapCanvas.height = 256;
    const ctx = vrMiniMapCanvas.getContext('2d');
    
    // Fill with black background initially
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, vrMiniMapCanvas.width, vrMiniMapCanvas.height);
    
    // Create a border
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, vrMiniMapCanvas.width - 6, vrMiniMapCanvas.height - 6);
    
    // Create texture
    vrMiniMapTexture = new THREE.CanvasTexture(vrMiniMapCanvas);
    
    // Create a plane to display the mini-map in VR
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.15), // Smaller size
        new THREE.MeshBasicMaterial({
            map: vrMiniMapTexture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        })
    );
    
    // Attach to the right controller wrist area
    if (controller2) {
        controller2.add(plane);
        // Position it on top of the controller
        plane.position.set(0, 0.08, -0.05);
        plane.rotation.x = -Math.PI / 3; // Angle for better visibility
        plane.rotation.z = Math.PI; // Flip to be readable
    }
    
    vrMiniMap = plane;
    return plane;
}

// Function to update the VR mini-map
function updateVRMiniMap() {
    if (!vrMiniMapCanvas || !vrMiniMapTexture || !isInVR) return;
    
    const ctx = vrMiniMapCanvas.getContext('2d');
    
    // Clear the mini-map
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, vrMiniMapCanvas.width, vrMiniMapCanvas.height);
    
    const mapWidth = vrMiniMapCanvas.width;
    const mapHeight = vrMiniMapCanvas.height;
    const centerX = mapWidth / 2;
    const centerZ = mapHeight / 2;
    
    // Draw the floor segments (dark gray)
    ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
    for (const floor of floorSegments) {
        if (floor.userData && floor.userData.aabb) {
            const aabb = floor.userData.aabb;
            const mapX = centerX + aabb.min.x * miniMapScale;
            const mapZ = centerZ + aabb.min.z * miniMapScale;
            const width = (aabb.max.x - aabb.min.x) * miniMapScale;
            const height = (aabb.max.z - aabb.min.z) * miniMapScale;
            ctx.fillRect(mapX, mapZ, width, height);
        }
    }
    
    // Draw the maze walls (light gray)
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    for (const wall of walls) {
        if (wall.userData && wall.userData.aabb) {
            const aabb = wall.userData.aabb;
            const mapX = centerX + aabb.min.x * miniMapScale;
            const mapZ = centerZ + aabb.min.z * miniMapScale;
            const width = (aabb.max.x - aabb.min.x) * miniMapScale;
            const height = (aabb.max.z - aabb.min.z) * miniMapScale;
            ctx.fillRect(mapX, mapZ, width, height);
        }
    }
    
    // Draw power-up locations
    if (powerUpSphereMesh && powerUpSphereMesh.visible) {
        ctx.fillStyle = 'rgba(255, 0, 0, 1.0)';
        const powerUpX = centerX + powerUpSphereMesh.position.x * miniMapScale;
        const powerUpZ = centerZ + powerUpSphereMesh.position.z * miniMapScale;
        ctx.beginPath();
        ctx.arc(powerUpX, powerUpZ, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    if (projectilePowerUpSphereMesh && projectilePowerUpSphereMesh.visible) {
        ctx.fillStyle = 'rgba(180, 0, 255, 1.0)';
        const projectilePowerUpX = centerX + projectilePowerUpSphereMesh.position.x * miniMapScale;
        const projectilePowerUpZ = centerZ + projectilePowerUpSphereMesh.position.z * miniMapScale;
        ctx.beginPath();
        ctx.arc(projectilePowerUpX, projectilePowerUpZ, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw puzzle door if active and exists (for VR minimap)
    if (isPuzzleDoorActive && puzzleDoorMesh) {
        if (puzzleDoorMesh.visible) { // Only draw panel if it's visible
            ctx.fillStyle = 'rgba(150, 75, 0, 0.8)'; // Brownish for door panel
            // Use main door mesh position and rotation for the panel representation
            const doorCenterX = centerX + puzzleDoorMesh.position.x * miniMapScale;
            const doorCenterZ = centerZ + puzzleDoorMesh.position.z * miniMapScale;
            // Determine width and height on map based on door's orientation
            const doorWidthOnMap = (puzzleDoorMesh.rotation.y === Math.PI / 2 ? DOOR_THICKNESS : DOOR_WIDTH) * miniMapScale;
            const doorHeightOnMap = (puzzleDoorMesh.rotation.y === Math.PI / 2 ? DOOR_WIDTH : DOOR_THICKNESS) * miniMapScale;

            ctx.save();
            ctx.translate(doorCenterX, doorCenterZ);
            ctx.rotate(puzzleDoorMesh.rotation.y); // Align with door's rotation
            ctx.fillRect(-doorWidthOnMap / 2, -doorHeightOnMap / 2, doorWidthOnMap, doorHeightOnMap);
            ctx.restore();
        }

        // Draw targets if they exist, door is not yet open, and puzzle is active
        if (!isPuzzleDoorOpen) {
            const targetRadiusOnMap = Math.max(1, 2 * miniMapScale * DOOR_TARGET_RADIUS); // Ensure minimum 1px radius
            if (puzzleDoorTarget1Mesh && puzzleDoorTarget1Mesh.visible) {
                ctx.fillStyle = isPuzzleDoorTarget1Hit ? 'rgba(255, 255, 0, 1.0)' : 'rgba(0, 255, 0, 1.0)';
                const target1WorldPos = new THREE.Vector3();
                puzzleDoorTarget1Mesh.getWorldPosition(target1WorldPos);
                const target1X = centerX + target1WorldPos.x * miniMapScale;
                const target1Z = centerZ + target1WorldPos.z * miniMapScale;
                ctx.beginPath();
                ctx.arc(target1X, target1Z, targetRadiusOnMap, 0, Math.PI * 2);
                ctx.fill();
            }
            if (puzzleDoorTarget2Mesh && puzzleDoorTarget2Mesh.visible) {
                ctx.fillStyle = isPuzzleDoorTarget2Hit ? 'rgba(255, 255, 0, 1.0)' : 'rgba(0, 255, 0, 1.0)';
                const target2WorldPos = new THREE.Vector3();
                puzzleDoorTarget2Mesh.getWorldPosition(target2WorldPos);
                const target2X = centerX + target2WorldPos.x * miniMapScale;
                const target2Z = centerZ + target2WorldPos.z * miniMapScale;
                ctx.beginPath();
                ctx.arc(target2X, target2Z, targetRadiusOnMap, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    // Draw player position with direction indicator
    const xrCamera = renderer.xr.getCamera();
    if (xrCamera) {
        const position = new THREE.Vector3();
        xrCamera.getWorldPosition(position);
        
        const playerX = centerX + position.x * miniMapScale;
        const playerZ = centerZ + position.z * miniMapScale;
        
        // Draw player direction indicator
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(xrCamera.quaternion);
        direction.normalize();
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playerX, playerZ);
        ctx.lineTo(
            playerX + direction.x * 15,
            playerZ + direction.z * 15
        );
        ctx.stroke();
        
        // Draw player circle
        ctx.fillStyle = 'rgba(0, 255, 255, 1.0)';
        ctx.beginPath();
        ctx.arc(playerX, playerZ, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw border around minimap
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, mapWidth - 6, mapHeight - 6);
    
    // Update the texture
    vrMiniMapTexture.needsUpdate = true;
}

