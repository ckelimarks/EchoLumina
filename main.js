// Echo Location Game MVP
// main.js

console.log("main.js loaded");

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Scene, Camera, Renderer
let scene, camera, renderer;
let controls;
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
const PARTICLES_PER_ECHO = 20000; // INCREASED for denser effect (was 7500)

// Input state
const keyboardState = {};

// Echo state - DEFINE THESE FIRST
const ECHO_HOLD_DURATION = 0.9; // seconds: How long particles stay bright
const ECHO_FADE_DURATION = 8.0; // seconds: How long particles take to fade (SLOWER FALL OFF)
const ECHO_FADE_IN_DURATION = 0.2; // seconds: How long particles take to fade in
const PROJECTILE_ECHO_PARTICLE_MULTIPLIER = 3.0; // INCREASED: Cast more particles for projectile echos

// NEW: Aftershock Constants
const AFTERSHOCK_DELAY = 0.3; // seconds: Delay after main pulse before aftershock starts
const AFTERSHOCK_DURATION = 0.5; // seconds: Duration of the aftershock flare-up effect
const AFTERSHOCK_MAX_ALPHA_BOOST = 0.65; // Max additional alpha at peak of aftershock (0 to 1)

// NOW DEFINE PARTICLE CONSTANTS THAT DEPEND ON THE ABOVE
const PARTICLE_INITIAL_LIFE = ECHO_FADE_IN_DURATION + ECHO_HOLD_DURATION + ECHO_FADE_DURATION; // Total lifespan 4.3s
const PARTICLE_BASE_SIZE = 0.05; 

// Lifecycle stages (based on life REMAINING)
const LIFESTAGE_FADEOUT_THRESHOLD = ECHO_FADE_DURATION; // When life <= this, particle is fading out (e.g., 4.0s)
const LIFESTAGE_HOLD_THRESHOLD = ECHO_FADE_DURATION + ECHO_HOLD_DURATION; // When life <= this, particle is holding (e.g., 4.1s)
// Fade-in happens when life > LIFESTAGE_HOLD_THRESHOLD

// Distance-based decay constants
const MAX_ECHO_DISTANCE_FOR_DECAY = 35.0; // Should match raycaster.far or desired max effect distance
const DISTANCE_DECAY_RATE_MULTIPLIER = 3.0; // For particles at echo origin, life decays (1+X) times faster. X is this value. (e.g. 3.0 means 4x faster)

// Timing
const clock = new THREE.Clock();

// NEW: Active Aftershocks Array
let activeAftershocks = [];

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

const PLAYER_START_X = -12;
const PLAYER_START_Z = 0;

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
let tossedProjectileMesh;
let tossedProjectileVelocity = new THREE.Vector3();
let isProjectileInFlight = false;
const PROJECTILE_SPEED = 25.0;
const PROJECTILE_MAX_LIFE = 3.0; // seconds
let projectileCurrentLife = 0;

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

    // --- RESTORED ORIGINAL SYNC LOGIC --- 
    if (!isProjectileEchoPowerUpActive || !backgroundBeatSound || (backgroundBeatSound.currentTime > 0 && !backgroundBeatSound.paused)) {
        console.log("[scheduleBeatSoundStart] Returning early. Conditions: isProjectileEchoPowerUpActive=", isProjectileEchoPowerUpActive, "backgroundBeatSound exists=", !!backgroundBeatSound, "beat sound already playing=", backgroundBeatSound && backgroundBeatSound.currentTime > 0 && !backgroundBeatSound.paused);
        return;
    }

    if (backgroundAmbianceSound && backgroundAmbianceSound.readyState >= 2 && backgroundAmbianceSound.duration > 0 && !backgroundAmbianceSound.paused) {
        // Ambiance sound is loaded and playing
        const timeRemainingInLoop = (backgroundAmbianceSound.duration - (backgroundAmbianceSound.currentTime % backgroundAmbianceSound.duration)) * 1000; // in ms
        
        console.log(`Scheduling beat sound to start in ${timeRemainingInLoop.toFixed(2)}ms`);
        startBeatSoundTimeout = setTimeout(() => {
            if (isProjectileEchoPowerUpActive && backgroundBeatSound) { // Double check power-up still active
                backgroundBeatSound.play().catch(e => console.error("Error playing backgroundBeatSound:", e));
                console.log("backgroundBeatSound started via schedule.");
            }
            startBeatSoundTimeout = null;
        }, timeRemainingInLoop);
    } else {
        // Ambiance sound not ready or not playing. Beat sound will attempt to start when ambiance starts, if power-up is active.
        console.log("Ambiance sound not ready for beat sync, will try when ambiance starts.");
    }
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

// MODIFIED: triggerEcho can now take an origin and color override
function triggerEcho(originPoint, echoColorOverride) {
    if (isPlayerDead) return;
    if (!audioContext) { 
        console.warn("AudioContext not ready, cannot play echo sound.");
        return;
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    console.log("Particle Echo triggered! Attempting to cast", PARTICLES_PER_ECHO, "rays.");

    // Sound Playback Logic
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

    if (soundBufferToPlay) {
        const source = audioContext.createBufferSource();
        source.buffer = soundBufferToPlay;
        source.connect(audioContext.destination);
        source.start(0); 
    } else if (soundFileName) {
        console.warn(`Audio buffer for ${soundFileName} not found or not loaded yet.`);
    }

    const origin = originPoint ? originPoint.clone() : camera.position.clone();
    let particlesActivatedThisEcho = 0;

    // Determine number of particles to cast for this specific echo
    let numParticlesToCast = PARTICLES_PER_ECHO;
    if (echoColorOverride === PROJECTILE_ECHO_PARTICLE_COLOR) {
        numParticlesToCast = Math.floor(PARTICLES_PER_ECHO * PROJECTILE_ECHO_PARTICLE_MULTIPLIER);
        console.log(`Projectile echo: Casting ${numParticlesToCast} particles.`);
    }

    // Determine echo particle color and raycaster distance
    let currentEchoColorToUse;
    let currentRaycasterFar;

    if (echoColorOverride) { // Projectile echo uses its specific color
        currentEchoColorToUse = echoColorOverride;
        currentRaycasterFar = PROJECTILE_ECHO_RAYCASTER_FAR; // USE new far distance
    } else if (isPowerUpActive) { // Red power-up (shorter range, different particle color)
        currentEchoColorToUse = POWERUP_COLOR; // Red particles for red power-up
        currentRaycasterFar = POWERUP_RAYCASTER_FAR;
    } else { // Normal player echo
        currentEchoColorToUse = NORMAL_ECHO_COLOR;
        currentRaycasterFar = NORMAL_RAYCASTER_FAR;
    }
    raycaster.far = currentRaycasterFar;

    const posArray = particleSystem.geometry.attributes.position.array;
    const colArray = particleSystem.geometry.attributes.color.array;
    const sizeArray = particleSystem.geometry.attributes.size.array;
    const lifeArray = particleSystem.geometry.attributes.life.array;
    const echoDistanceArray = particleSystem.geometry.attributes.echoDistance.array; 

    let affectedParticleIndicesForAftershock = []; // NEW: Collect indices for aftershock

    for (let i = 0; i < numParticlesToCast; i++) {
        const phi = Math.acos(-1 + (2 * i) / numParticlesToCast);
        const theta = Math.sqrt(numParticlesToCast * Math.PI) * phi;
        const direction = new THREE.Vector3(
            Math.cos(theta) * Math.sin(phi),
            Math.sin(theta) * Math.sin(phi),
            Math.cos(phi)
        );
        raycaster.set(origin, direction);
        const intersects = raycaster.intersectObjects(echoableObjects, false);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const point = intersection.point;
            particlesActivatedThisEcho++;
            const pIdx = particleIndex % MAX_PARTICLES;

            posArray[pIdx * 3 + 0] = point.x;
            posArray[pIdx * 3 + 1] = point.y;
            posArray[pIdx * 3 + 2] = point.z;

            // Determine particle color: special highlight for power-up sphere
            let finalParticleColor = currentEchoColorToUse;
            if (intersection.object === powerUpSphereMesh && powerUpSphereMesh.visible) {
                finalParticleColor = POWERUP_COLOR; // Highlight with power-up's own red color
            }

            colArray[pIdx * 4 + 0] = finalParticleColor.r;
            colArray[pIdx * 4 + 1] = finalParticleColor.g;
            colArray[pIdx * 4 + 2] = finalParticleColor.b;
            colArray[pIdx * 4 + 3] = 0.0; 

            sizeArray[pIdx] = 0.0; 
            lifeArray[pIdx] = PARTICLE_INITIAL_LIFE;
            
            const distance = point.distanceTo(origin); 
            echoDistanceArray[pIdx] = distance; 
            affectedParticleIndicesForAftershock.push(pIdx); // NEW: Add particle index

            // Removed detailed particle activation log for brevity now
            // if (particlesActivatedThisEcho <= 5) { 
            //     console.log(`Activated particle in slot ${pIdx}: pos(${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}), dist: ${distance.toFixed(2)}`);
            // }
            particleIndex++;
        }
    }
    // console.log("Particles activated this echo:", particlesActivatedThisEcho); // Can be spammy

    if (particlesActivatedThisEcho > 0) {
        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.color.needsUpdate = true;
        particleSystem.geometry.attributes.size.needsUpdate = true;
        particleSystem.geometry.attributes.life.needsUpdate = true; 
        particleSystem.geometry.attributes.echoDistance.needsUpdate = true; 
        particleSystem.geometry.computeBoundingSphere();

        // NEW: Schedule aftershock if particles were activated
        if (affectedParticleIndicesForAftershock.length > 0) {
            const aftershockStartTime = clock.elapsedTime + AFTERSHOCK_DELAY;
            const aftershockEndTime = aftershockStartTime + AFTERSHOCK_DURATION;
            activeAftershocks.push({
                startTime: aftershockStartTime,
                endTime: aftershockEndTime,
                particleIndices: affectedParticleIndicesForAftershock,
                maxAlphaBoost: AFTERSHOCK_MAX_ALPHA_BOOST // Could be customized per echo type later
            });
        }
    }

    renderer.render(scene, camera);
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

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    // scene.fog = new THREE.Fog(0x000000, 1, 35); // TEMPORARILY DISABLE FOG
    console.log("Scene fog temporarily disabled for debugging.");

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, NORMAL_RAYCASTER_FAR);
    camera.position.set(2, playerHeight, 18); // Start position for maze

    // Renderer
    const canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000); // Black background
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

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

    // Maze Walls - NEW
    buildMaze(); // Call function to construct the maze

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

    // NEW: Create Tossed Projectile Mesh (initially invisible)
    const tossedProjectileGeom = new THREE.SphereGeometry(0.1, 8, 8); // Made smaller (was 0.2)
    const tossedProjectileMat = new THREE.MeshStandardMaterial({ 
        color: PROJECTILE_ECHO_PARTICLE_COLOR, // Use the echo particle color for the projectile itself
        emissive: PROJECTILE_ECHO_PARTICLE_COLOR,
        emissiveIntensity: 0.7
    });
    tossedProjectileMesh = new THREE.Mesh(tossedProjectileGeom, tossedProjectileMat);
    tossedProjectileMesh.visible = false; // Start invisible
    // Not adding to scene yet, will be added when thrown

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

    // Process Aftershocks
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
    activeAftershocks = remainingAftershocks;

    if (lifeDataChanged || sizeDataChanged || colorDataChanged) {
        if (lifeDataChanged) particleSystem.geometry.attributes.life.needsUpdate = true;
        if (sizeDataChanged) particleSystem.geometry.attributes.size.needsUpdate = true;
        if (colorDataChanged) particleSystem.geometry.attributes.color.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

function animate() {
    requestAnimationFrame(animate);

    if (isPlayerDead) {
        renderer.render(scene, camera);
        return; 
    }

    const deltaTime = clock.getDelta(); // Define deltaTime ONCE here for the frame

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
    // NEW: Timer for Projectile Power-up
    if (isProjectileEchoPowerUpActive) {
        projectilePowerUpRemainingTime -= deltaTime;
        if (projectilePowerUpRemainingTime <= 0) {
            isProjectileEchoPowerUpActive = false;
            projectilePowerUpRemainingTime = 0;
            stopBeatSound(); // Stop the beat when purple power-up expires
            if (projectilePowerUpSphereMesh) projectilePowerUpSphereMesh.visible = true;
            console.log("Projectile Power-up expired.");
        }
    }

    // Note: Projectile power-up is a one-time use per pickup for now, no timer. // <<< This comment is now outdated

    handlePlayerMovement(deltaTime); 

    // NEW: Projectile Animation and Collision Logic
    if (isProjectileInFlight && tossedProjectileMesh) {
        projectileCurrentLife -= deltaTime;

        // Apply gravity to projectile
        tossedProjectileVelocity.y -= GRAVITY * deltaTime * 0.5; // Reduced gravity effect for projectile
        tossedProjectileMesh.position.addScaledVector(tossedProjectileVelocity, deltaTime);

        // Collision detection for projectile
        const projectileAABB = new THREE.Box3().setFromObject(tossedProjectileMesh);
        let projectileCollided = false;

        for (const obj of echoableObjects) {
            // Don't collide with power-up spheres themselves, or if object is invisible
            if (!obj.visible || obj.userData.isPowerUp || obj.userData.isProjectilePowerUp) {
                continue; 
            }
            if (obj.userData.aabb && projectileAABB.intersectsBox(obj.userData.aabb)) {
                console.log("Projectile collided with an object!");

                // Move the projectile back slightly along its last path before triggering echo
                const backwardStep = tossedProjectileVelocity.clone().normalize().multiplyScalar(-0.15); // Small step back
                tossedProjectileMesh.position.add(backwardStep);

                // Also, move the echo origin slightly up from the impact surface
                const echoOrigin = tossedProjectileMesh.position.clone();
                echoOrigin.y += 0.1; // Nudge upwards

                triggerEcho(echoOrigin, PROJECTILE_ECHO_PARTICLE_COLOR);
                
                isProjectileInFlight = false;
                scene.remove(tossedProjectileMesh);
                tossedProjectileMesh.visible = false;
                projectileCollided = true;

                // Projectile power-up effect ends on impact - REMOVED - No longer ends power-up on impact
                // if(isProjectileEchoPowerUpActive) { // This check is still fine, but actions changed
                //     isProjectileEchoPowerUpActive = false;
                //     stopBeatSound();
                //     if (projectilePowerUpSphereMesh) projectilePowerUpSphereMesh.visible = true;
                //     console.log("Projectile impacted, deactivating power-up and stopping beat.");
                // }
                break;
            }
        }

        if (!projectileCollided && projectileCurrentLife <= 0) {
            console.log("Projectile lifespan expired.");
            isProjectileInFlight = false;
            scene.remove(tossedProjectileMesh);
            tossedProjectileMesh.visible = false;
            // Optionally trigger an echo where it expired
            // triggerEcho(tossedProjectileMesh.position.clone(), PROJECTILE_ECHO_PARTICLE_COLOR);
            
            // Projectile power-up effect ends on lifespan expiry - REMOVED - No longer ends power-up on expiry
            // if(isProjectileEchoPowerUpActive) {
            //     isProjectileEchoPowerUpActive = false;
            //     stopBeatSound();
            //     if (projectilePowerUpSphereMesh) projectilePowerUpSphereMesh.visible = true;
            //     console.log("Projectile expired, deactivating power-up and stopping beat.");
            // }
        }
    }

    // Particle animation logic 
    const lifeArray = particleSystem.geometry.attributes.life.array;
    const sizeArray = particleSystem.geometry.attributes.size.array; 
    const colArray = particleSystem.geometry.attributes.color.array; 
    const echoDistanceArray = particleSystem.geometry.attributes.echoDistance.array; 
    
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

            const dist = echoDistanceArray[i]; 
            const distanceRatio = Math.min(1.0, dist / currentEffectiveRaycasterFar);
            const invertedDistanceRatio = 1.0 - distanceRatio; 
            const decayMultiplier = 1.0 + (invertedDistanceRatio * DISTANCE_DECAY_RATE_MULTIPLIER); 
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
                baseAlpha = easedFadeOutProgress;
                baseSize = PARTICLE_BASE_SIZE * easedFadeOutProgress;
            } else if (lifeArray[i] <= LIFESTAGE_HOLD_THRESHOLD) { // HOLD
                baseAlpha = 1.0;
                baseSize = PARTICLE_BASE_SIZE;
            } else { // FADE IN
                const timeSinceSpawn = PARTICLE_INITIAL_LIFE - lifeArray[i];
                const linearFadeInProgress = Math.min(1.0, timeSinceSpawn / ECHO_FADE_IN_DURATION);
                const easedFadeInProgress = easeOutCubic(linearFadeInProgress);
                baseAlpha = easedFadeInProgress;
                baseSize = PARTICLE_BASE_SIZE * easedFadeInProgress;
            }
        }

        // Set initial attributes based on lifecycle (before aftershock adjustments)
        if (colArray[i * 4 + 3] !== baseAlpha) {
            colArray[i * 4 + 3] = baseAlpha;
            colorDataChanged = true;
        }
        if (sizeArray[i] !== baseSize) {
            sizeArray[i] = baseSize;
            sizeDataChanged = true;
        }
    }

    // Aftershocks - Process after base lifecycle attributes are set for the frame
    const currentElapsedTime = clock.elapsedTime;
    const stillActiveAftershocks = [];
    for (let s = 0; s < activeAftershocks.length; s++) {
        const aftershock = activeAftershocks[s];

        if (currentElapsedTime < aftershock.startTime) {
            stillActiveAftershocks.push(aftershock); // Not active yet
            continue;
        }
        if (currentElapsedTime >= aftershock.endTime) {
            // Aftershock is over, don't keep it.
            continue;
        }

        // Aftershock is active
        const aftershockEffectElapsedTime = currentElapsedTime - aftershock.startTime;
        const aftershockProgress = aftershockEffectElapsedTime / (aftershock.endTime - aftershock.startTime);
        const aftershockIntensity = Math.sin(aftershockProgress * Math.PI); // Sine curve for 0 -> 1 -> 0 intensity
        const currentAlphaBoost = aftershock.maxAlphaBoost * aftershockIntensity;

        for (let p = 0; p < aftershock.particleIndices.length; p++) {
            const pIdx = aftershock.particleIndices[p];
            
            const particleBaseAlphaThisFrame = colArray[pIdx * 4 + 3];
            let boostedAlpha = particleBaseAlphaThisFrame + currentAlphaBoost;

            if (lifeArray[pIdx] <= 0 && particleBaseAlphaThisFrame === 0.0) {
                boostedAlpha = currentAlphaBoost * 0.3; // Make aftershock on dead particles much fainter
            }
            
            const finalAlpha = Math.min(1.0, boostedAlpha);

            if (colArray[pIdx * 4 + 3] !== finalAlpha) {
                colArray[pIdx * 4 + 3] = finalAlpha;
                colorDataChanged = true; // Ensure flag is set
            }
        }
        stillActiveAftershocks.push(aftershock); // Keep it if it hasn't ended
    }
    activeAftershocks = stillActiveAftershocks;

    if (lifeDataChanged || sizeDataChanged || colorDataChanged) {
        if (lifeDataChanged) particleSystem.geometry.attributes.life.needsUpdate = true;
        if (sizeDataChanged) particleSystem.geometry.attributes.size.needsUpdate = true;
        if (colorDataChanged) particleSystem.geometry.attributes.color.needsUpdate = true;
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
    // Using a slightly larger scale and adjusting coordinates from previous thought process
    // These coordinates define the CENTER of the wall segments.

    // Outer boundary estimations (adjust as needed)
    const minX = -15, maxX = 20;
    const minZ = -12, maxZ = 18;

    // Top-Left Area & Corridor to Top Enemy
    createWall(-7.5, -10, 15, 'horizontal'); // Top wall of big room
    createWall(-15, -2.5, 15, 'vertical');   // Left wall of big room
    createWall(-7.5, 5, 15, 'horizontal');   // Bottom wall of big room (partially)
    createWall(0, -2.5, 10, 'vertical');     // Right wall of big room / corridor wall
    createWall(7.5, -10, 15, 'horizontal');  // Top wall of corridor to ENEMY
    createWall(2.5, 0, 5, 'horizontal');    // Bottom wall of short corridor part
    createWall(15, -5, 10, 'vertical');      // Right wall of corridor to ENEMY / Left of ENEMY

    // Top ENEMY Area
    createWall(22.5, -10, 15, 'horizontal'); // Top wall ENEMY
    createWall(30, -2.5, 15, 'vertical');   // Right wall ENEMY
    createWall(22.5, 5, 15, 'horizontal');  // Bottom wall ENEMY
    // createWall(15, -2.5, 10, 'vertical'); // Already created as part of corridor

    // Central Passage (below top ENEMY, above PUZZLEs)
    createWall(7.5, 5, 15, 'horizontal'); // Wall between corridor & central passage (shares with big room bottom)
                                         // This might need adjustment or one part removed based on desired openings
                                         // Assuming wall -7.5, 5, 15 covers this. Then create wall below it:
    createWall(12.5, 8, 25, 'horizontal');  // Bottom of central horizontal passage

    // Connecting Walls and PUZZLE area separators
    createWall(0, 10, 10, 'vertical');      // Vertical wall between big room exit and PUZZLE areas
    createWall(-7.5, 13, 15, 'horizontal'); // Wall below top PUZZLE area
    // createWall(   0, 17.5, 5, 'vertical'); // Short vertical between PUZZLE areas (optional detail)
    createWall(-7.5, 22, 15, 'horizontal'); // Wall below bottom PUZZLE area

    // Right side structure (jagged parts, leading to bottom ENEMY)
    createWall(20, 10, 5, 'vertical');     // Vertical down from central passage, right of PUZZLEs
    createWall(22.5, 13, 5, 'horizontal');
    createWall(25, 15.5, 5, 'vertical');
    createWall(22.5, 18, 5, 'horizontal');
    createWall(20, 20.5, 5, 'vertical');

    // Bottom ENEMY Area
    createWall(12.5, 18, 15, 'horizontal'); // Top wall of bottom ENEMY
    createWall(20, 25.5, 15, 'vertical');   // Right wall of bottom ENEMY
    createWall(12.5, 33, 15, 'horizontal'); // Bottom wall of bottom ENEMY
    createWall(5, 25.5, 15, 'vertical');     // Left wall of bottom ENEMY

    // Connecting wall from bottom-left of maze to bottom ENEMY
    createWall(-2.5, 22, 15, 'horizontal'); // Shares with wall below bottom PUZZLE
                                            // This connection implies the puzzle area is not fully enclosed on the right
                                            // This may require reviewing the diagram and intention for openings.
    createWall(5, 17.5, 10, 'vertical');  // vertical wall right of bottom puzzle area connecting down. 

    console.log("Maze built with", walls.length, "wall segments.");

    // Adjust player starting position if needed based on maze
    // camera.position.set(0, playerHeight, 10); // Example: move further into a potential starting area
    // Current start (0, playerHeight, 5) might be inside a wall or too cramped. Let's try -12, playerHeight, 0
    camera.position.set(-12, playerHeight, 0);
    console.log("Player starting position set to -12,0 within the maze.");
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
    if (!tossedProjectileMesh || !camera) return;

    isProjectileInFlight = true;
    projectileCurrentLife = PROJECTILE_MAX_LIFE;

    // Set projectile start position and add to scene
    tossedProjectileMesh.position.copy(camera.position);
    // Optional: offset slightly in front of camera so it doesn't spawn inside player
    const offsetDirection = new THREE.Vector3();
    camera.getWorldDirection(offsetDirection);
    tossedProjectileMesh.position.addScaledVector(offsetDirection, 0.5); 

    scene.add(tossedProjectileMesh);
    tossedProjectileMesh.visible = true;
    // REMOVE: isProjectileEchoPowerUpActive = false; 
    // REMOVE: stopBeatSound(); 
    // REMOVE: if (projectilePowerUpSphereMesh) { projectilePowerUpSphereMesh.visible = true; }

    // Set projectile velocity
    camera.getWorldDirection(tossedProjectileVelocity);
    tossedProjectileVelocity.multiplyScalar(PROJECTILE_SPEED);

    console.log("Projectile thrown!");
} 