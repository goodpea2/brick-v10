
// equipmentManager.js
// Handles all equipment logic by listening to game events.

import { state } from './state.js';
import * as event from './eventManager.js';
import { XP_SETTINGS, BALL_STATS } from './balancing.js';
import { Projectile, MiniBall, Ball } from './ball.js';
import { Brick } from './brick.js';
import { FloatingText } from './vfx.js';


let gameController = null;

// --- Helper Functions ---

/**
 * Gets the list of active equipment for a given ball.
 * @param {object} ball - The ball instance to check equipment for.
 * @returns {Array} - An array of active equipment objects.
 */
function getActiveEquipment(ball) {
    if (!ball || ball.isGhost) return [];
    
    // Check if the ball object itself has the helper method (Ball and MiniBall classes now have it)
    if (typeof ball.getActiveEquipment === 'function') {
        return ball.getActiveEquipment();
    }
    
    // Fallback for projectiles or legacy objects
    if (ball instanceof Ball && ball.instanceId && state.ballEquipment[ball.instanceId]) {
        return state.ballEquipment[ball.instanceId].filter(Boolean);
    }
    
    if (ball instanceof MiniBall && ball.parentInstanceId && state.ballEquipment[ball.parentInstanceId]) {
        return state.ballEquipment[ball.parentInstanceId].filter(Boolean);
    }

    // Fallback: Get equipment by type
    const type = ball.type === 'miniball' ? ball.parentType : ball.type;
    if (!type || !state.ballEquipment[type]) {
        return [];
    }
    return state.ballEquipment[type].filter(Boolean);
}


// --- Event Handlers ---

function onTurnStart(payload) {
    const { ball } = payload;
    const equipment = getActiveEquipment(ball);
    equipment.forEach(item => {
        if (item.id === 'phaser') {
            state.phaserCharges = item.value.main;
        }
        if (item.id === 'clone_cannon') {
            const count = item.value;
            for (let i = 0; i < count; i++) {
                // Ensure we clone the vectors so the clones start from the initial launch position/velocity
                if (state.p5Instance && state.p5Instance.queueAction) {
                    state.p5Instance.queueAction({
                        type: 'spawn_clone',
                        ball: {
                            pos: ball.pos.copy(),
                            vel: ball.vel.copy(),
                            type: ball.type,
                            instanceId: ball.instanceId // Pass instance ID to clones so they inherit equipment
                        },
                        isFullClone: true, // Spawn a full Ball like BallCage
                        delay: 15 * (i + 1) // 0.25s staggered
                    });
                }
            }
        }
        if (item.id === 'trash_bin') {
            state.invulnerabilityTimer = Math.max(state.invulnerabilityTimer, item.value.invuln * 60);
        }
    });
}
// ... (rest of file remains unchanged as getActiveEquipment helper is the key fix)

function onTurnEnd(payload) {
    // Consume used equipment in Trial Run
    if (state.gameMode === 'trialRun') {
        const p = state.p5Instance;
        let consumedCount = 0;
        
        // Iterate over all keys (could be types or instance IDs now)
        for (const key in state.ballEquipment) {
            const slots = state.ballEquipment[key];
            for (let i = 0; i < slots.length; i++) {
                if (slots[i]) {
                    // Remove from inventory list to prevent re-equipping
                    // Since we populated playerEquipment with unique instances in startTrialRun,
                    // finding by ID is enough, or finding by object ref.
                    const itemToRemove = slots[i];
                    const itemIndex = state.playerEquipment.findIndex(eq => eq.id === itemToRemove.id);
                    if (itemIndex > -1) {
                        state.playerEquipment.splice(itemIndex, 1);
                    }
                    
                    // Clear slot
                    slots[i] = null;
                    consumedCount++;
                }
            }
        }
        
        if (consumedCount > 0 && p && p.addFloatingText) {
            // Can't show floating text easily without a position, maybe just log or update UI silently
            // UI update happens automatically on next render/interaction
        }
    }
}

function onBallHitWall(payload) {
    const { ball, velBefore, wallNormal } = payload;
    const equipment = getActiveEquipment(ball);
    const isMini = ball instanceof MiniBall;

    equipment.forEach(item => {
        switch(item.id) {
            case 'wall_explosion':
                const chargeAmount = isMini ? item.value.mini : item.value.main;
                state.wallExplosionCharge += chargeAmount;
                state.capacitorChargeEffect = 30; // For VFX
                break;
            case 'wall_bullets':
                if (velBefore && wallNormal && state.p5Instance) {
                    const bulletCount = isMini ? item.value.mini : item.value.main;
                    const spread = item.config.spread || Math.PI / 8; // Default spread
                    state.p5Instance.spawnWallBullets(ball.pos, bulletCount, item.config.bulletDamage, velBefore, wallNormal, spread);
                }
                break;
            case 'aim_assist':
                // Check counter
                if (ball.consecutiveWallHits >= item.value && state.p5Instance) {
                    // Redirect logic
                    const bricks = state.p5Instance.getBricks();
                    const board = state.p5Instance.getBoard();
                    let target = null;
                    let minDistSq = Infinity;
                    
                    // Find nearest brick (normal or goal)
                    for(let c=0; c<board.cols; c++) for(let r=0; r<board.rows; r++) {
                        const b = bricks[c][r];
                        if (b && (b.type === 'normal' || b.type === 'goal' || b.type === 'extraBall')) {
                            const bPos = b.getPixelPos(board);
                            const center = {x: bPos.x + b.size/2, y: bPos.y + b.size/2};
                            const dSq = (ball.pos.x - center.x)**2 + (ball.pos.y - center.y)**2;
                            if (dSq < minDistSq) {
                                minDistSq = dSq;
                                target = center;
                            }
                        }
                    }
                    
                    if (target) {
                        const p = state.p5Instance;
                        const desiredVel = p.constructor.Vector.sub(p.createVector(target.x, target.y), ball.pos);
                        desiredVel.setMag(ball.vel.mag()); // Maintain speed
                        ball.vel = desiredVel;
                        ball.consecutiveWallHits = 0; // Reset
                        
                        // Visual indicator
                        if (p.addFloatingText) {
                            p.addFloatingText("Aim Assist!", p.color(100, 255, 100), {size: 12}, ball.pos);
                        }
                    }
                }
                break;
            case 'corner_camper':
                // Use previousWallHitFrame to check timing between the last two hits
                // Ensure previousWallHitFrame is valid (not initial -999) to avoid trigger on 2nd hit of game
                if (ball.previousWallHitFrame > 0 && (ball.lastWallHitFrame - ball.previousWallHitFrame) < item.config.triggerFrames) { 
                    const count = isMini ? item.value.mini : item.value.main;
                    const spread = item.config.spread || Math.PI / 8;
                    // Spawn bullet spray
                    if (state.p5Instance) {
                        state.p5Instance.spawnWallBullets(ball.pos, count, item.config.bulletDamage, velBefore, wallNormal, spread);
                    }
                }
                break;
        }
    });
}

function onBallHitBrick(payload) {
    const { ball, brick, hitResult } = payload;
    const equipment = getActiveEquipment(ball);
    const isMini = ball instanceof MiniBall;

    equipment.forEach(item => {
        switch(item.id) {
            case 'healer_leech':
                if (brick.overlay === 'healer') {
                    if (!isMini || item.value.applyToMini) {
                        if(state.p5Instance) state.p5Instance.healBall(item.value.main);
                    }
                }
                break;
            case 'ramping_damage':
                state.rampingDamage = 0;
                state.rampingDamageTimer = 0;
                state.overchargeParticles = [];
                break;
            case 'nullifier':
                if (!isMini || item.value.applyToMini) {
                    // Set cooldown
                    ball.nullifierCooldown = item.value.cooldown * 60;
                }
                break;
            case 'clingy':
                if (!isMini || item.value.applyToMini) {
                    ball.clingyTimer = item.value.duration * 60;
                }
                break;
        }
    });

    if (state.wallExplosionCharge > 0) {
        const wallExplosionItem = equipment.find(item => item.id === 'wall_explosion');
        if (wallExplosionItem) {
            // Check if mini balls trigger explosion based on config (default: false)
            if (!isMini || (wallExplosionItem.value.miniExplodes !== false)) {
                const radiusTiles = wallExplosionItem.config.radiusTiles;
                if(state.p5Instance) {
                    state.p5Instance.explode(hitResult.center, state.p5Instance.getBoard().gridUnitSize * radiusTiles, state.wallExplosionCharge, 'wall_capacitor');
                }
                state.wallExplosionCharge = 0;
            }
        }
    }
}

function onMiniBallHitWall(payload) {
    // Forward to generic handler now that it supports mini balls
    onBallHitWall({ ball: payload.miniBall, velBefore: payload.velBefore, wallNormal: payload.wallNormal });
}

function onMiniBallHitBrick(payload) {
    // Forward to generic handler
    onBallHitBrick({ ball: payload.miniBall, brick: payload.brick, hitResult: payload.hitResult });
}

function onBrickDestroyed(payload) {
    const { sourceBall, brick } = payload;
    if (!sourceBall || typeof sourceBall !== 'object') return; 
    
    const equipment = getActiveEquipment(sourceBall);
    const isMini = sourceBall instanceof MiniBall;

    equipment.forEach(item => {
        if (item.id === 'vampire') {
            if (!isMini || item.value.applyToMini) {
                if(state.p5Instance) state.p5Instance.healBall(item.value.main);
            }
        }
        if (item.id === 'roulette') {
            const chance = Math.random();
            const p = state.p5Instance;
            if (chance < item.config.coinChance) {
                if(p) p.addCoins(item.value);
                if (p && brick) {
                    p.addFloatingText(`+${item.value} Coins!`, p.color(255, 215, 0), { isBold: true }, brick.getPixelPos(p.getBoard()));
                }
            } else if (chance < item.config.coinChance + item.config.selfDamageChance) {
                if (p && p.damageBall) {
                    // Logic inside sketch.js handles death if this damage kills the ball
                    p.damageBall(item.config.selfDamage, 'roulette');
                    if (p && brick) {
                        p.addFloatingText(`Roulette: -${item.config.selfDamage} HP`, p.color(255, 50, 50), { isBold: true }, brick.getPixelPos(p.getBoard()));
                    }
                }
            }
        }
    });
}

function onBrickSpawned(payload) {
    // No equipment currently affects this
}

function onCoinCollected(payload) {
    const { ball } = payload;
    if (!ball) return;
    const equipment = getActiveEquipment(ball);
    const coinBoost = equipment.find(item => item.id === 'coin_boost');
    if (coinBoost) {
        state.coinsForDuplication += payload.amount;
        while (state.coinsForDuplication >= coinBoost.value) {
            state.coinsForDuplication -= coinBoost.value;
            if(state.p5Instance) state.p5Instance.addCoins(1);
        }
    }
}

function onXpCollected(payload) {
    const { ball } = payload;
    if (!ball) return;
    const equipment = getActiveEquipment(ball);
    const isMini = ball instanceof MiniBall;

    equipment.forEach(item => {
        // Most items check appliesToMini automatically via value.applyToMini property
        if (isMini && item.value.applyToMini === false) return;

        switch(item.id) {
            case 'xp_magnet':
                const bonusXp = XP_SETTINGS.xpPerOrb * (item.value.xp - 1);
                state.pendingXp += bonusXp;
                break;
            case 'xp_heal':
                state.orbsForHeal++;
                if (state.orbsForHeal >= item.value) {
                    if(state.p5Instance) state.p5Instance.healBall(item.config.healAmount);
                    state.orbsForHeal = 0;
                }
                break;
            case 'last_stand':
                state.orbsForLastStand++;
                if (state.orbsForLastStand >= item.value.orbs) {
                    state.orbsForLastStand = 0;
                    state.lastStandCharges += item.value.bullets;
                    if(state.p5Instance && state.p5Instance.addFloatingText) {
                         state.p5Instance.addFloatingText(`+${item.value.bullets} charges!`, {levels: [255,100,100]}, {size: 12}, ball.pos);
                    }
                }
                break;
        }
    });
}

function onPowerUpUsed(payload) {
    const { ball } = payload;
    const equipment = getActiveEquipment(ball);

    equipment.forEach(item => {
        switch(item.id) {
            case 'powerup_invulnerability':
                state.invulnerabilityTimer = Math.max(state.invulnerabilityTimer, item.value * 60);
                break;
            case 'mine_power':
                const minesToSpawn = item.value;
                const p = state.p5Instance;
                if (!p) return;
                const bricks = p.getBricks();
                const board = p.getBoard();
                let eligibleBricks = [];
                for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) if (bricks[c][r] && bricks[c][r].type === 'normal' && !bricks[c][r].overlay) eligibleBricks.push(bricks[c][r]);
                
                if (p) p.shuffle(eligibleBricks, true);

                for (let i = 0; i < Math.min(minesToSpawn, eligibleBricks.length); i++) {
                    eligibleBricks[i].overlay = 'mine';
                }
                break;
            case 'tax_return':
                if(state.p5Instance) {
                    state.p5Instance.addCoins(item.value);
                    const hpToAdd = item.config.brickHpBuff;
                    const radius = state.p5Instance.getBoard().gridUnitSize * item.config.brickHpBuffRadiusTiles;
                    const allBricks = state.p5Instance.getBricks();
                    const gameBoard = state.p5Instance.getBoard();
    
                    for (let c = 0; c < gameBoard.cols; c++) {
                        for (let r = 0; r < gameBoard.rows; r++) {
                            const brick = allBricks[c][r];
                            if (brick) {
                                const brickPos = brick.getPixelPos(gameBoard);
                                const centerPos = {
                                    x: brickPos.x + (brick.size * brick.widthInCells) / 2,
                                    y: brickPos.y + (brick.size * brick.heightInCells) / 2,
                                };
                                const distSq = (ball.pos.x - centerPos.x) ** 2 + (ball.pos.y - centerPos.y) ** 2;
                                if (distSq < radius ** 2) {
                                    brick.heal(hpToAdd);
                                }
                            }
                        }
                    }
                }
                break;
            case 'overflow':
                // Overflow logic happens once per turn start, usually handled in Ball logic or here if needed.
                // Currently Ball logic handles initial overflow stats application.
                break;
        }
    });
}

function onBallHpLost(payload) {
    const { ball, amount, position } = payload;
    if (!ball) return;
    const equipment = getActiveEquipment(ball);
    const retaliationItem = equipment.find(item => item.id === 'retaliation');

    if (retaliationItem) {
        state.hpLostForRetaliation += amount;
        while (state.hpLostForRetaliation >= retaliationItem.value) {
            if(state.p5Instance) state.p5Instance.spawnHomingProjectile(position, retaliationItem, ball);
            state.hpLostForRetaliation -= retaliationItem.value;
        }
    }
}

function onBallDying(payload) {
    const { ball } = payload;
    if (!ball) return;
    const equipment = getActiveEquipment(ball);
    const lastStandItem = equipment.find(item => item.id === 'last_stand');
    if (lastStandItem && state.lastStandCharges > 0) {
        const bulletCount = state.lastStandCharges;
        const p = state.p5Instance;
        if (!p) return;
        const board = p.getBoard();
        const speed = board.gridUnitSize * 0.5;
        const damage = lastStandItem.config.bulletDamage;
        const spread = p.TWO_PI;
        const projectiles = [];
        for (let i = 0; i < bulletCount; i++) {
            const angle = (spread / bulletCount) * i;
            const vel = p.constructor.Vector.fromAngle(angle).mult(speed);
            projectiles.push(new Projectile(p, ball.pos.copy(), vel, damage));
        }
        p.addProjectiles(projectiles);
        state.lastStandCharges = 0;
    }
    
    // Removed DoomTicker explosion logic here to prevent double triggering.
    // It is now handled in ball.js when isDead becomes true.
}


function onComboAdded(payload) {
    const { newComboCount } = payload;
    const p = state.p5Instance;
    
    // Combo event doesn't pass ball always, we use the active ball logic from sketch usually.
    // But payload might not have ball. We should find the active ball in play.
    
    const activeBallType = state.selectedBallType; 

    const equipment = state.ballEquipment[activeBallType]?.filter(Boolean) || [];
    
    const healStreak = equipment.find(item => item.id === 'heal_streak');
    if (healStreak) {
        // Updated Logic: Check against current combo instead of stacking
        if (newComboCount > 0 && newComboCount % healStreak.value === 0) {
            const healAmount = healStreak.config ? healStreak.config.healAmount : 10;
            if(state.p5Instance) state.p5Instance.healBall(healAmount);
        }
    }
}

function onComboLost(payload) {
    // No equipment currently affects this
}


/**
 * Initializes the equipment manager and subscribes to all relevant game events.
 * This should be called once when the game starts.
 * @param {object} controller - The main game controller to interact with the game.
 */
export function initializeEquipmentManager(controller) {
    gameController = controller;

    event.subscribe('TurnStart', onTurnStart);
    event.subscribe('TurnEnd', onTurnEnd);
    event.subscribe('BallHitWall', onBallHitWall);
    event.subscribe('BallHitBrick', onBallHitBrick);
    event.subscribe('MiniBallHitWall', onMiniBallHitWall);
    event.subscribe('MiniBallHitBrick', onMiniBallHitBrick);
    event.subscribe('BrickDestroyed', onBrickDestroyed);
    event.subscribe('BrickSpawned', onBrickSpawned);
    event.subscribe('CoinCollected', onCoinCollected);
    event.subscribe('XpCollected', onXpCollected);
    event.subscribe('PowerUpUsed', onPowerUpUsed);
    event.subscribe('BallHpLost', onBallHpLost);
    event.subscribe('BallDying', onBallDying);
    event.subscribe('ComboAdded', onComboAdded);
    event.subscribe('ComboLost', onComboLost);

    console.log("Equipment Manager Initialized.");
}


/**
 * For a given event, calculates the debug strings that equipment would generate.
 * @param {string} eventName - The name of the event.
 * @param {object} payload - The event's payload.
 * @returns {Array<string>} - An array of debug strings.
 */
export function getDebugReturnsForEvent(eventName, payload) {
    const { ball, miniBall, brick, combo } = payload;
    const activeBall = ball || miniBall;
    
    let equipment = [];
    if (activeBall) {
        equipment = getActiveEquipment(activeBall);
    } else if (eventName === 'ComboAdded') {
        equipment = state.ballEquipment[state.selectedBallType]?.filter(Boolean) || [];
    }

    const debugReturns = [];
    const isMini = activeBall instanceof MiniBall;

    equipment.forEach(item => {
        switch (eventName) {
            case 'TurnStart':
                if (item.id === 'phaser') debugReturns.push(`[Phaser] Gained ${item.value.main} charges`);
                if (item.id === 'clone_cannon') debugReturns.push(`[Clone Cannon] Queued ${item.value} clones`);
                if (item.id === 'trash_bin') debugReturns.push(`[Trash Bin] Invulnerable for ${item.value.invuln}s`);
                break;
            case 'BallHitWall':
            case 'MiniBallHitWall':
                if (item.id === 'wall_explosion') debugReturns.push(`[Kinetic Capacitor] Charges +${isMini ? item.value.mini : item.value.main}`);
                if (item.id === 'wall_bullets') debugReturns.push(`[Ricochet Shotgun] Fires ${isMini ? item.value.mini : item.value.main} bullets`);
                if (item.id === 'corner_camper') debugReturns.push(`[Corner Camper] Rapid hit check passed`);
                if (item.id === 'aim_assist') debugReturns.push(`[Aim Assist] Count ${ball.consecutiveWallHits}/${item.value}`);
                break;
            case 'BallHitBrick':
            case 'MiniBallHitBrick':
                if (item.id === 'direct_damage') debugReturns.push(`[Power Shard] Adds +${isMini ? item.value.mini : item.value.main} dmg`);
                if (item.id === 'deconstructor') debugReturns.push(`[Deconstructor] +${isMini ? item.value.mini : item.value.main} dmg`);
                if (item.id === 'healer_leech' && brick.overlay === 'healer') {
                    if (!isMini || item.value.applyToMini) debugReturns.push(`[Leeching Spore] Heals +${item.value.main} HP`);
                }
                if (item.id === 'combo_damage') debugReturns.push(`[Combo Catalyst] Adds +${(combo || 0) * (isMini ? item.value.mini : item.value.main)} dmg`);
                if (item.id === 'executioner' && brick.health <= item.value.main) {
                    if (!isMini || item.value.applyToMini !== false) debugReturns.push(`[Weak Grind] Executes brick`);
                }
                if (item.id === 'damage_reduction') {
                    if (!isMini || item.value.applyToMini) debugReturns.push(`[Squishy] Reduces base dmg by ${(item.value.main * 100).toFixed(0)}%`);
                }
                if (item.id === 'ramping_damage') debugReturns.push(`[Overcharge Core] Resets`);
                if (item.id === 'phaser' && state.phaserCharges > 0) {
                    if (!isMini || item.value.applyToMini) debugReturns.push(`[Phaser] No-bounce hit, ${state.phaserCharges - 1} left`);
                }
                if (item.id === 'impact_distributor') {
                    if (!isMini || item.value.applyToMini !== false) debugReturns.push(`[Impact Distributor] Ball takes +${item.value.brick} dmg`);
                }
                if (item.id === 'wall_explosion' && state.wallExplosionCharge > 0) {
                    if (!isMini || item.value.miniExplodes !== false) debugReturns.push(`[Kinetic Capacitor] Discharges for ${state.wallExplosionCharge.toFixed(0)} dmg`);
                }
                if (item.id === 'nullifier') {
                    debugReturns.push(`[Nullifier] Cooldown set to ${item.value.cooldown}s`);
                }
                if (item.id === 'clingy') {
                    debugReturns.push(`[Clingy] Slowed for ${item.value.duration}s`);
                }
                break;
            case 'BrickDestroyed':
                if (item.id === 'vampire') {
                    if (!isMini || item.value.applyToMini) debugReturns.push(`[Vampirium] Heals +${item.value.main} HP`);
                }
                if (item.id === 'roulette') {
                    debugReturns.push(`[Roulette] Chance triggered`);
                }
                break;
            case 'CoinCollected':
                if (item.id === 'coin_boost') {
                    const coinsForNext = item.value - ((state.coinsForDuplication + payload.amount) % item.value);
                    debugReturns.push(`[Coin Duplicator] Needs ${coinsForNext} more`);
                }
                break;
            case 'XpCollected':
                if (item.id === 'xp_magnet') debugReturns.push(`[Magnetron] XP boosted by ${Math.round((item.value.xp - 1) * 100)}%`);
                if (item.id === 'xp_heal') {
                    const orbsForNext = item.value - ((state.orbsForHeal + 1) % item.value);
                    debugReturns.push(`[Healing Orbs] Needs ${orbsForNext} more`);
                }
                if (item.id === 'last_stand') {
                    const orbsNeeded = item.value.orbs - ((state.orbsForLastStand + 1) % item.value.orbs);
                    debugReturns.push(`[Last Stand] Needs ${orbsNeeded} more for +${item.value.bullets} charges`);
                }
                break;
            case 'PowerUpUsed':
                if (item.id === 'powerup_invulnerability') debugReturns.push(`[Energy Shield] Invulnerable for ${item.value}s`);
                if (item.id === 'mine_power') debugReturns.push(`[Mine Cast] Spawns ${item.value} mines`);
                if (item.id === 'tax_return') debugReturns.push(`[Tax Return] Gains ${item.value} coins, heals bricks`);
                if (item.id === 'overflow') {
                    if (!isMini || item.value.applyToMini) debugReturns.push(`[Overflow] Gained +1 use, +${item.value.main} HP`);
                }
                break;
            case 'BallHpLost':
                 if (item.id === 'retaliation') {
                    const hpForNext = item.value - ((state.hpLostForRetaliation + payload.amount) % item.value);
                    debugReturns.push(`[Hurt Missile] Needs ${hpForNext} more HP loss`);
                }
                if (item.id === 'impact_distributor' && (payload.source === 'wall' || payload.source === 'miniball_wall')) {
                    debugReturns.push(`[Impact Distributor] Reduces wall dmg by ${-item.value.wall}`);
                }
                break;
            case 'BallDying':
                 if (item.id === 'last_stand' && state.lastStandCharges > 0) {
                     debugReturns.push(`[Last Stand] Fires ${state.lastStandCharges} bullets`);
                 }
                 if (item.id === 'doom_ticker') {
                     // Handled in ball.js
                 }
                break;
            case 'ComboAdded':
                if (item.id === 'heal_streak') debugReturns.push(`[Heal Streak] Active`);
                break;
        }
    });

    return debugReturns;
}
