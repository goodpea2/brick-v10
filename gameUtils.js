
import { UNLOCK_LEVELS, XP_SETTINGS, NPC_BALL_STATS, INVASION_MODE_PARAMS, ENCHANTER_STATS, BRICK_STATS, ROSTER_CONSTANTS } from './balancing.js';
import { sounds } from './sfx.js';
import * as ui from './ui/index.js';
import * as event from './eventManager.js';
import { state } from './state.js';
import { ChainVFX, Particle, FloatingText, FlyingIcon } from './vfx.js';
import { handleFarmlandGeneration } from './farmland.js';
import { handleSawmillGeneration } from './sawmill.js';
import { findNearestEmptyCage } from './brickLogic.js';

export function checkAndUnlockBalls(state) {
    const LEVEL_BALL_UNLOCKS = {
        [UNLOCK_LEVELS.EXPLOSIVE_BALL]: 'explosive',
        [UNLOCK_LEVELS.SPLIT_BALL]: 'split',
        [UNLOCK_LEVELS.PIERCING_BALL]: 'piercing',
        [UNLOCK_LEVELS.BRICK_BALL]: 'brick',
        [UNLOCK_LEVELS.BULLET_BALL]: 'bullet',
        [UNLOCK_LEVELS.HOMING_BALL]: 'homing'
    };

    let unlockedAny = false;
    for (let lvl = 1; lvl <= state.mainLevel; lvl++) {
        const unlockedType = LEVEL_BALL_UNLOCKS[lvl];
        if (unlockedType) {
            let instanceToEquip = null;
            let isNew = false;
            const existingInstance = state.ballInventory.find(b => b.type === unlockedType);
            if (existingInstance) {
                const isEquipped = state.currentLoadout.includes(existingInstance.instanceId);
                if (!isEquipped) instanceToEquip = existingInstance;
            } else {
                const instanceId = crypto.randomUUID();
                const newBall = {
                    instanceId: instanceId,
                    type: unlockedType,
                    name: `${unlockedType.charAt(0).toUpperCase() + unlockedType.slice(1)} Ball`,
                    level: 1,
                    outcomes: [],
                    costMultipliers: [],
                    stats: {},
                    isFavorite: false,
                    obtainedAt: Date.now()
                };
                state.ballInventory.push(newBall);
                instanceToEquip = newBall;
                isNew = true;
                unlockedAny = true;
            }
            if (instanceToEquip) {
                const emptySlotIndex = state.currentLoadout.findIndex(slot => !slot);
                if (emptySlotIndex !== -1) {
                    state.currentLoadout[emptySlotIndex] = instanceToEquip.instanceId;
                    unlockedAny = true; 
                    if (state.p5Instance && state.p5Instance.addFloatingText) {
                        const msg = isNew ? `${instanceToEquip.name} Unlocked!` : `${instanceToEquip.name} Equipped!`;
                        state.p5Instance.addFloatingText(msg, state.p5Instance.color(100, 255, 100), {isBold: true, size: 24, lifespan: 150});
                    }
                } else if (isNew) {
                    if (state.p5Instance && state.p5Instance.addFloatingText) {
                        state.p5Instance.addFloatingText(`${instanceToEquip.name} Unlocked!`, state.p5Instance.color(255, 255, 100), {isBold: true, size: 24, lifespan: 150});
                    }
                }
            }
        }
    }
    return unlockedAny;
}

export function addXp(amount, context, state) {
    if (state.gameMode === 'invasionDefend' && context.runStats) {
        if (context.runStats.totalXpCollected !== undefined) context.runStats.totalXpCollected += amount;
    } else if (context.levelStats) {
        if (context.levelStats.xpCollected !== undefined) context.levelStats.xpCollected += amount;
    }
    state.currentXp += amount;
    state.lifetimeXp += amount;
    while (state.currentXp >= state.xpForNextLevel) {
        state.currentXp -= state.xpForNextLevel;
        state.mainLevel++; 
        state.xpForNextLevel = XP_SETTINGS.xpBaseAmount * state.mainLevel * (state.mainLevel + 1) / 2;
        sounds.levelUp();
        ui.showLevelUpModal(state.mainLevel);
        ui.updateUIVisibilityForMode(state.gameMode);
        if (state.mainLevel >= 19) {
            state.playerGems += 10;
            state.lifetimeGems += 10;
        }
        const hasUpdates = checkAndUnlockBalls(state);
        if (hasUpdates && state.p5Instance) {
            ui.updateBallSelectorUI(state.mainLevel, context.ballsLeft, context.giantBallCount, context.gameState);
            setTimeout(() => {
                ui.updateBallSelectorUI(state.mainLevel, context.ballsLeft, context.giantBallCount, context.gameState);
            }, 100);
        }
    }
}

export function handleChainDamage(sourceBall, sourceBrick, context) {
    const { p, board, bricks, chainVFXs } = context;
    if (!sourceBall || !sourceBrick) return [];
    
    // LIGHTNING CHAIN DAMAGE ADDITIVE FIX
    let chainDamage = sourceBall.bonusChainDamage || 0;
    if (sourceBall.type === 'lightning') {
        chainDamage += (state.upgradeBonuses.lightning_chainDamage || 0);
    }
    
    if (chainDamage <= 0) return [];
    const allBricks = [];
    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && brick !== sourceBrick && !processed.has(brick)) {
                allBricks.push(brick);
                processed.add(brick);
            }
        }
    }
    const sourcePos = sourceBrick.getPixelPos(board).add(sourceBrick.size / 2, sourceBrick.size / 2);
    allBricks.sort((a, b) => {
        const aPos = a.getPixelPos(board);
        const bPos = b.getPixelPos(board);
        const distA = p.dist(sourcePos.x, sourcePos.y, aPos.x, aPos.y);
        const distB = p.dist(sourcePos.x, sourcePos.y, bPos.x, bPos.y);
        return distA - distB;
    });
    const targets = allBricks.slice(0, 3);
    const hitEvents = [];
    targets.forEach(targetBrick => {
        const hitResult = targetBrick.hit(chainDamage, 'chain_damage', board);
        if (hitResult) {
            hitEvents.push({ type: 'brick_hit', ...hitResult, source: 'chain_damage' });
            const targetPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
            chainVFXs.push(new ChainVFX(p, sourcePos, targetPos));
        }
    });
    return hitEvents;
}

export function determineEnchanterDrop(npc, state, p) {
    if (state.mainLevel < UNLOCK_LEVELS.ENCHANTMENT) return null;

    if (npc.guaranteedEnchanterDrop) {
        return npc.guaranteedEnchanterDrop; // Directly return the drop object
    }
    const stats = NPC_BALL_STATS[npc.type];
    if (!stats) return null;
    const dropRoll = p.random();
    if (dropRoll < stats.cost * INVASION_MODE_PARAMS.ENCHANTER_DROP_RATE_PER_COST) {
        if (p.random() < INVASION_MODE_PARAMS.ENCHANTER_II_UPGRADE_CHANCE) {
            return { type: 'enchanter2', amount: 1 };
        } else {
            return { type: 'enchanter1', amount: 1 };
        }
    }
    return null;
}

export function determineShellDrop(npc, state, p) {
    const stats = NPC_BALL_STATS[npc.type];
    if (!stats) return null;
    
    // Chance based on cost. e.g. 0.5% per cost. 100 cost = 50%.
    const dropChance = stats.cost * INVASION_MODE_PARAMS.SHELL_DROP_RATE_PER_COST;
    
    if (p.random() < dropChance) {
        const amount = Math.floor(p.random(INVASION_MODE_PARAMS.SHELL_DROP_AMOUNT_MIN, INVASION_MODE_PARAMS.SHELL_DROP_AMOUNT_MAX + 1));
        return { type: 'shell', amount: amount };
    }
    return null;
}

export function updateHomeBaseTimers(timeMultiplier = 1, context, state) {
    const { board, homeBaseBricks, flyingIcons, p } = context;
    const processedBricks = new Set();
    
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processedBricks.has(brick)) {
                processedBricks.add(brick);
                
                // --- Resource Producers (Farmland / Sawmill) ---
                if ((brick.type === 'Farmland' || brick.type === 'Sawmill') && brick.productionRate > 0) {
                    const amountToAdd = (brick.productionRate / 3600) * timeMultiplier;
                    
                    brick.internalResourcePool = Math.min(
                        brick.localResourceCapacity,
                        brick.internalResourcePool + amountToAdd
                    );

                    const BATCH_COST = 10;
                    
                    while (brick.internalResourcePool >= BATCH_COST) {
                        let success = false;
                        
                        if (brick.type === 'Farmland') {
                            success = handleFarmlandGeneration(p, brick, board, flyingIcons, state.gameMode === 'homeBase');
                        } else if (brick.type === 'Sawmill') {
                            success = handleSawmillGeneration(p, brick, board);
                        }
                        
                        if (success) {
                            brick.internalResourcePool -= BATCH_COST;
                        } else {
                            break;
                        }
                    }
                }

                // --- Ball Producers ---
                if (brick.type === 'BallProducer') {
                    if (brick.heldBall || (brick.production.queueCount > 0 && brick.production.progress >= brick.production.maxTimer)) {
                        const emptyCage = findNearestEmptyCage(brick, homeBaseBricks, board);
                        if (emptyCage) {
                            const finishedType = brick.heldBall || brick.production.type;
                            
                            emptyCage.inventory.push(finishedType);
                            const startPos = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
                            const endPos = emptyCage.getPixelPos(board).add(emptyCage.size / 2, emptyCage.size / 2);

                            if (state.gameMode === 'homeBase') {
                                flyingIcons.push(new FlyingIcon(p, startPos, endPos, '⚽️', { size: 16, lifespan: 40 }));
                            }

                            brick.heldBall = null;
                            brick.production.progress = 0;
                            brick.production.queueCount--;
                            if (brick.production.queueCount === 0) {
                                brick.production.type = null;
                            }
                            
                            if (brick === context.selectedBrick) {
                                ui.updateContextPanel(brick);
                            }
                        } else {
                            brick.heldBall = brick.production.type;
                            brick.production.progress = brick.production.maxTimer; 
                        }
                    } 
                    else if (brick.production.queueCount > 0 && !brick.heldBall) {
                        brick.production.progress += 1 * timeMultiplier;
                    }
                
                    if (brick === context.selectedBrick) {
                        const progressFillEl = document.getElementById('ball-producer-progress-fill');
                        if (progressFillEl) {
                            const percent = (brick.production.progress / brick.production.maxTimer) * 100;
                            progressFillEl.style.width = `${percent}%`;
                        }
                    }
                }
            }
        }
    }

    for (let i = flyingIcons.length - 1; i >= 0; i--) {
        const fi = flyingIcons[i];
        fi.update();
        if (fi.isFinished()) {
            flyingIcons.splice(i, 1);
        }
    }
}

export function fireLasers(context) {
    const { p, board, bricks, particles } = context;
    
    // Move existing lasers to vanishing list
    context.vanishingLasers.push(...context.lasers.map(l => ({ ...l, vanishTimer: 20 })));

    // VFX for vanishing old lasers
    context.lasers.forEach(laser => {
        const numParticles = 30;
        const laserVector = p.constructor.Vector.sub(laser.end, laser.start);
        const visibleLength = p.max(board.width, board.height) * 1.5;
        const visibleEnd = p.constructor.Vector.add(laser.start, laserVector.copy().setMag(visibleLength));

        for (let i = 0; i < numParticles; i++) {
            const posOnLaser = p.constructor.Vector.lerp(laser.start, visibleEnd, p.random());
            if (posOnLaser.x > board.x && posOnLaser.x < board.x + board.width && posOnLaser.y > board.y && posOnLaser.y < board.y + board.height) {
                const perp = laserVector.copy().rotate(p.HALF_PI).normalize();
                const vel = perp.mult(p.random(-5, 5));
                particles.push(new Particle(p, posOnLaser.x, posOnLaser.y, p.color(255, 80, 200), 1, { vel, size: p.random(2, 5), lifespan: 30 }));
            }
        }
    });

    context.lasers = [];
    const uniqueBricks = new Set();
    for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) if (bricks[c][r]) uniqueBricks.add(bricks[c][r]);

    uniqueBricks.forEach(brick => {
        if (brick.overlay === 'laser') {
            sounds.laserFire();
            const start = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
            const angle = p.random(p.TWO_PI);
            const end = p.createVector(
                start.x + p.cos(angle) * 2000, 
                start.y + p.sin(angle) * 2000
            );
            context.lasers.push({ start, end, angle, brick });
        }
    });
}

export function updateShieldAuras(context) {
    const { p, board, bricks } = context;
    const allBricksForShieldCheck = [];
    const shieldGenerators = [];
    const uniqueBricksForShieldCheck = new Set();

    // 1. Gather all bricks and reset shield status
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && !uniqueBricksForShieldCheck.has(brick)) {
                brick.isShieldedByAura = false; 
                allBricksForShieldCheck.push(brick);
                if (brick.type === 'shieldGen') {
                    shieldGenerators.push(brick);
                }
                uniqueBricksForShieldCheck.add(brick);
            }
        }
    }

    // 2. Apply shield status based on range to ShieldGens
    shieldGenerators.forEach(shieldGen => {
        const shieldGenPos = shieldGen.getPixelPos(board).add((shieldGen.size * shieldGen.widthInCells) / 2, (shieldGen.size * shieldGen.heightInCells) / 2);
        const auraRadiusSq = p.pow(board.gridUnitSize * BRICK_STATS.shieldGen.auraRadiusTiles, 2);
        
        allBricksForShieldCheck.forEach(brick => {
            // Check config for protectability (defaulting to true if undefined, but LogBrick is explicitly false)
            // brick !== shieldGen ensures a generator instance doesn't shield itself
            if (brick !== shieldGen && BRICK_STATS.canBeProtectedByShieldGen[brick.type]) {
                const brickPos = brick.getPixelPos(board).add((brick.size * brick.widthInCells) / 2, (brick.size * brick.heightInCells) / 2);
                const distSq = p.pow(shieldGenPos.x - brickPos.x, 2) + p.pow(shieldGenPos.y - brickPos.y, 2);
                if (distSq <= auraRadiusSq) {
                    brick.isShieldedByAura = true;
                }
            }
        });
    });
}
