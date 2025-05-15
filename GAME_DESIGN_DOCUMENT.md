# Echoes in the Dark - Game Design Document (Prototype)

## 1. Overview

**Concept:** "Echoes in the Dark" is a first-person exploration game prototype where the player navigates a dark environment using an echolocation mechanic. Light is scarce, and sound is the primary tool for revealing the world.

**Setting:** The game currently takes place in a dark, minimalist maze-like structure. The atmosphere is intended to be mysterious and slightly unsettling.

**Player Goal (Implicit):** The current primary goal is to navigate the environment, understand its layout through echolocation, and survive hazards like pits.

## 2. Core Gameplay Mechanics

### 2.1. Echolocation

*   **Activation:** The player can trigger an echolocation pulse.
    *   Standard echo: Triggered by a left mouse click (when not holding the projectile power-up).
*   **Visualization:**
    *   The echo is visualized by particles appearing on surfaces hit by conceptual sound waves.
    *   Rays are cast from the echo's origin point in multiple directions.
    *   Where rays intersect with designated "echoable" objects, particles are generated.
*   **Particle Properties:**
    *   **Color:**
        *   Default: Cyan (`NORMAL_ECHO_COLOR`)
        *   Red Power-up Active: Red (`POWERUP_COLOR`)
        *   Projectile Echo: Purple (`PROJECTILE_ECHO_PARTICLE_COLOR`)
    *   **Size:** Start at `PARTICLE_BASE_SIZE`, then shrink during fade-out. Particles also fade-in their size.
    *   **Lifecycle:**
        *   **Fade-in:** Particles appear and increase opacity and size over `ECHO_FADE_IN_DURATION`.
        *   **Hold:** Particles remain at full opacity and base size for `ECHO_HOLD_DURATION`.
        *   **Fade-out:** Particles gradually decrease opacity (alpha) and size over `ECHO_FADE_DURATION` (or `POWERUP_ECHO_FADE_DURATION` if red power-up is active).
    *   **Distance-based Decay:** Particles further from the echo origin fade slightly faster and can have their overall lifespan shortened.
*   **Audio Cue:** A distinct sound plays each time an echo is triggered, with different sounds for normal, red power-up, and projectile echoes.

### 2.2. Player Movement

*   **Perspective:** First-person.
*   **Controls:** Standard `PointerLockControls` (mouse for looking, keyboard for movement).
*   **Locomotion:**
    *   **Walking:** Standard speed.
    *   **Sprinting:** Increased speed while holding the `Shift` key.
    *   **Jumping:** Ability to perform a vertical jump.
*   **Physics:**
    *   **Acceleration/Friction:** Player movement has a sense of momentum.
    *   **Gravity:** Affects the player, enabling jumping and falling.
    *   **Collision:** Player collides with wall segments, preventing passage.

### 2.3. Interaction & Power-ups

*   **Red Echo Power-up:**
    *   **Pickup:** A visible sphere object in the world. Collecting it activates the power-up.
    *   **Effect:** For `POWERUP_DURATION` seconds:
        *   Echolocation pulses cast particles that are red.
        *   Echo range is shorter (`POWERUP_RAYCASTER_FAR`).
        *   Particle fade duration is different (`POWERUP_ECHO_FADE_DURATION`).
    *   **Sound:** A unique pickup sound plays. Power-up echoes have their own set of audio cues.
    *   The pickup item becomes visible again after the power-up expires or is replaced.
*   **Projectile Echo Power-up:**
    *   **Pickup:** A visible purple sphere object. Collecting it grants one projectile echo.
    *   **Activation:** When active, left-clicking throws a projectile.
    *   **Projectile Behavior:**
        *   Travels in an arc, affected by gravity.
        *   Has a maximum lifetime (`PROJECTILE_MAX_LIFE`).
        *   Visualized as a small, emissive purple sphere.
    *   **Echo on Impact:** When the projectile hits an echoable surface:
        *   It triggers an echolocation pulse originating from the impact point.
        *   This echo uses purple particles (`PROJECTILE_ECHO_PARTICLE_COLOR`) and has a larger particle count (`PROJECTILE_ECHO_PARTICLE_MULTIPLIER`) and greater range (`PROJECTILE_ECHO_RAYCASTER_FAR`).
    *   **Sound:** A unique pickup sound plays. Projectile echoes have their own set of audio cues.
    *   The pickup item becomes visible again after the projectile is thrown or if the player picks up the Red Echo Power-up.
    *   Picking up one power-up deactivates the other if it was active, making its pickup item reappear.

### 2.4. Death & Respawn

*   **Cause of Death:** Falling into a designated pit area below a certain Y-level (`DEATH_Y_LEVEL`).
*   **Indication:**
    *   A visual death screen overlay (semi-transparent tint and text message) appears.
    *   Pointer lock is released.
    *   A falling sound is played.
*   **Respawn:** After `DEATH_SCREEN_DURATION`, the player respawns at a predefined starting position (`PLAYER_START_X`, `PLAYER_START_Z`).

## 3. Controls

*   **Mouse Look:** Aim / Turn Camera
*   **`W` / `ArrowUp`:** Move Forward
*   **`S` / `ArrowDown`:** Move Backward
*   **`A` / `ArrowLeft`:** Strafe Left
*   **`D` / `ArrowRight`:** Strafe Right
*   **`Space Bar`:** Jump
*   **`Left Shift` / `Right Shift`:** Sprint (hold)
*   **`Left Mouse Click`:**
    *   If Projectile Echo Power-up is active: Throw projectile.
    *   Otherwise: Trigger standard/Red Echolocation pulse.
*   **`Escape` (Implicit via PointerLockControls):** Release mouse lock.

## 4. Visuals

*   **Overall Aesthetic:** Dark, minimalist, relying on echolocation particles to define the space.
*   **Environment:**
    *   **Floor:** Composed of large, flat, dark grey segments. Includes a pit area.
    *   **Walls:** Dark grey, forming a simple maze structure.
    *   **Power-up Items:**
        *   Red Echo Power-up: A sphere (dark grey when inactive, visually distinct when ready to be picked up by its particle interaction).
        *   Projectile Echo Power-up: A purple sphere.
*   **Effects:**
    *   **Echolocation Particles:** Small, point-based particles with dynamic color, size, and alpha (opacity) for fade-in/hold/fade-out effects.
    *   **Tossed Projectile:** A small, emissive purple sphere.
*   **User Interface (UI):**
    *   **Reticle:** A simple crosshair visible when pointer lock is active.
    *   **Death Screen:** A full-screen semi-transparent black overlay with a "You Died" message.

## 5. Audio

*   **Echolocation Pulses:**
    *   **Standard Echo:** Cycling through a set of 4 unique sound files (`echonote1.mp3` - `echonote4.mp3`).
    *   **Red Power-up Echo:** Cycling through a set of 4 unique sound files (`redechonote1.mp3` - `redechonote4.mp3`).
    *   **Projectile Echo:** Cycling through a set of 4 unique sound files (`purpleechonote1.mp3` - `purpleechonote4.mp3`).
*   **Player Movement:**
    *   **Footsteps:** A looping `footsteps.mp3` plays when the player is walking/running.
        *   Playback speed increases when sprinting.
        *   Smooth fade-in when movement starts and fade-out when movement stops.
*   **Interaction Sounds:**
    *   **Power-up Pickup:** A single sound (`pickupsound.mp3`) plays when either power-up is collected.
*   **Environment/Event Sounds:**
    *   **Fall Sound:** A sound (`fallsound.mp3`) plays when the player dies by falling.
*   **Ambiance:**
    *   A looping background ambient sound (`bgambience.mp3`) plays to create atmosphere.

## 6. Current Objects & Entities

*   **Player:** Represented by the camera, controlled via `PointerLockControls`.
*   **Floor Segments:** Static `THREE.Mesh` objects forming the ground.
*   **Walls:** Static `THREE.Mesh` objects forming the maze barriers.
*   **Red Echo Power-up Sphere:** A `THREE.Mesh` object that can be collected.
*   **Projectile Echo Power-up Sphere:** A `THREE.Mesh` object that can be collected.
*   **Tossed Projectile:** A dynamic `THREE.Mesh` object created when the projectile power-up is used.
*   **Particle System:** A single `THREE.Points` object managing all echolocation particles.

## 7. Technical Details

*   **Engine/Library:** Three.js (r150+)
*   **Language:** JavaScript (utilizing ES6 Modules)
*   **Controls Implementation:** `PointerLockControls` from Three.js addons.
*   **Rendering:** WebGL via Three.js.
*   **Audio Engine:** Web Audio API for sound effects and spatial audio considerations. HTMLAudioElement for background ambiance.
*   **Particle System:** Custom implementation using `THREE.BufferGeometry` and `THREE.PointsMaterial`, with attributes updated directly for performance.

## 8. Brainstorming / Future Ideas

*(This section is for future additions and collaborative brainstorming. Examples could include:)*
*   *More complex level designs and puzzles requiring specific echo techniques.*
*   *Different types of surfaces that react differently to echoes (e.g., sound dampening, sound amplifying).*
*   *"Enemy" entities that react to sound or emit their own echoes.*
*   *Narrative elements discovered through echoes.*
*   *More diverse soundscapes and environmental audio storytelling.*
*   *Additional power-ups or echo modifications (e.g., focused echo, persistent echo).* 

*   **Interactive Quadrants:** Implement areas with distinct color materials that produce unique sounds when the player walks over them. Consider using different sound profiles for each material to enhance the immersive experience. Next steps include designing the sound profiles and integrating them with the player's movement detection.

*   **Rhythmic Pulses:** Synchronize echolocation pulses with the background music's rhythm. This can be achieved by analyzing the music's BPM and aligning pulse emissions accordingly. Explore using a real-time audio analysis library to extract BPM and trigger pulses in sync with the beat.

*   **Teleportation Mantras:** Develop a mechanic where specific pulse patterns (mantras) allow the player to teleport or phase through walls. This could involve a combination of rhythm-based input and specific pulse sequences. Design a set of mantras and corresponding effects, and implement a system to recognize and execute these patterns.

*   **Beat-Driven Gameplay:** Introduce a "Simon Says" style mini-game where players must emit pulses in time with the beat to progress. This could involve visual cues and increasing difficulty levels. Plan the mini-game's structure and integrate it with the existing pulse mechanics.

*   **Sampler/MIDI Controller Concept:** Transform the game into an interactive audio experience by allowing players to trigger sound samples through their actions. This could involve creating a virtual MIDI controller interface within the game. Next steps include designing the interface and mapping player actions to specific audio samples.
