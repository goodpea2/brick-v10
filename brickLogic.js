
// brickLogic.js
import { FlyingIcon, FloatingText } from './vfx.js';
import * as dom from '../dom.js';
import { state } from './state.js';
import { sounds } from './sfx.js';
import * as event from './eventManager.js';
import { generateRandomEquipment } from './equipment.js';
import { Ball, MiniBall } from './ball.js';
import { createSplat, createBrickHitVFX } from './vfx.js';
import { XP_SETTINGS, BRICK_STATS, CHARGE_SETTINGS, BALL_STATS } from './balancing.js';
import { Shockwave } from './vfx.js';
import { animateWoodParticles, animateFoodParticles } from './ui/domVfx.js';
import { renderTrialLootPanel } from './ui/invasionLoot.js';
import { BRICK_LEVELING_DATA } from './brickLeveling.js';

export function findNearestEmptyCage(producer, allBricks, board) {
    let nearestCage = null;
    let min_dist_sq = Infinity;

    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = allBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.type === 'EmptyCage' && brick.inventory.length < brick.ballCapacity) {
                    const distSq = (producer.c - brick.c)**2 + (producer.r - brick.r)**2;
                    if (distSq < min_dist_sq) {
                        min_dist_sq = distSq;
                        nearestCage = brick;
                    }
                }
            }
        }
    }
    return nearestCage;
}

export function addGoalXp(amount, p, gameController) {
    if (amount <= 0 || state.gameMode !== 'homeBase') return;
    
    state.goalBrickXp += amount;
    
    let leveledUp = false;
    
    while (true) {
        const currentLevelData = BRICK_LEVELING_DATA.goal[state.goalBrickLevel - 1];
        if (!currentLevelData) break;

        const maxXp = currentLevelData.maxXp;
        
        if (state.goalBrickXp >= maxXp) {
            state.goalBrickXp -= maxXp;
            state.goalBrickLevel++;
            leveledUp = true;
        } else {
            break;
        }
    }
    
    if (leveledUp && gameController) {
        levelUpGoalBricks(p, gameController.getBoard(), gameController.getHomeBaseBricks());
        if (gameController.addFloatingText) {
             gameController.addFloatingText("Goal Bricks Leveled Up!", p.color(255, 215, 0), { isBold: true, size: 24 });
        }
        sounds.levelUp();
    }
}

export function levelUpGoalBricks(p, board, bricks) {
    if (!bricks) return;
    
    const levelData = BRICK_LEVELING_DATA.goal[state.goalBrickLevel - 1];
    if (!levelData) return;

    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && brick.type === 'goal' && !processed.has(brick)) {
                processed.add(brick);
                brick.level = state.goalBrickLevel;
                brick.maxHealth = levelData.stats.maxHealth;
                brick.health = brick.maxHealth;
                
                const pos = brick.getPixelPos(board).add(brick.size/2, brick.size/2);
                if (p && typeof p.spawnShockwave === 'function') {
                    p.spawnShockwave(pos.x, pos.y, brick.size * 2, p.color(255, 215, 0));
                }
            }
        }
    }
}

export function harvestResourceFromProducer(brick, { homeBaseBricks, board, p, flyingIcons, gameController }) {
    if (!brick || brick.internalResourcePool <= 0) return false;

    const resourceType = brick.type === 'Farmland' ? 'food' : 'wood';
    const playerResourceKey = resourceType === 'food' ? 'playerFood' : 'playerWood';
    const maxResourceKey = resourceType === 'food' ? 'maxFood' : 'maxWood';
    
    const spaceAvailable = Math.max(0, state[maxResourceKey] - state[playerResourceKey]);
    if (spaceAvailable <= 0) {
        if(gameController?.addFloatingText) gameController.addFloatingText(`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} storage full!`, {levels: [255,100,100]}, {isBold: true});
        return false;
    }

    const amountToHarvest = Math.min(brick.internalResourcePool, spaceAvailable);
    if (amountToHarvest <= 0) return false;

    brick.internalResourcePool -= amountToHarvest;

    const icon = resourceType === 'food' ? '🥕' : '🪵';
    const bankEl = resourceType === 'food' ? dom.foodBankEl : dom.woodBankEl;
    const sound = resourceType === 'food' ? sounds.foodCollect : sounds.woodCollect;
    
    let storageBricks = [];
    const uniqueBricks = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const b = homeBaseBricks[c][r];
            if (b && !uniqueBricks.has(b)) {
                uniqueBricks.add(b);
                if (b.type === (resourceType === 'food' ? 'FoodStorage' : 'WoodStorage')) {
                    storageBricks.push(b);
                }
            }
        }
    }

    let targetBrick = null;
    let min_dist_sq = Infinity;

    storageBricks.forEach(storage => {
        const distSq = (storage.c - brick.c)**2 + (storage.r - brick.r)**2;
        if (distSq < min_dist_sq) {
            min_dist_sq = distSq;
            targetBrick = storage;
        }
    });

    const startPos = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
    let endPos;

    if (targetBrick) {
        endPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
    } else {
        const rect = bankEl.getBoundingClientRect();
        const canvasRect = p.canvas.getBoundingClientRect();
        endPos = p.createVector(
            rect.left - canvasRect.left + rect.width / 2,
            rect.top - canvasRect.top + rect.height / 2
        );
    }
    
    const count = Math.ceil(amountToHarvest);
    const unitAmount = amountToHarvest / count;

    for (let i = 0; i < count; i++) {
        flyingIcons.push(new FlyingIcon(p, startPos, endPos, icon, {
            size: board.gridUnitSize * 0.4,
            lifespan: 30 + p.random(10),
            onComplete: () => {
                state[playerResourceKey] = Math.min(state[maxResourceKey], state[playerResourceKey] + unitAmount);
            }
        }));
    }
    
    sound();
    return true;
}

export function harvestFood(brick, { homeBaseBricks, board, p, flyingIcons, gameController }) {
    if (brick.food <= 0) return;

    const spaceAvailable = Math.max(0, state.maxFood - state.playerFood);
    if (spaceAvailable <= 0) {
        if (gameController?.addFloatingText) gameController.addFloatingText("Food storage full!", {levels: [255,100,100]}, {isBold: true});
        return;
    }

    const amountToHarvest = Math.min(brick.food, spaceAvailable);
    if (amountToHarvest <= 0) return;

    brick.food -= amountToHarvest;

    let storageBricks = [];
    const uniqueBricks = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const b = homeBaseBricks[c][r];
            if (b && !uniqueBricks.has(b)) {
                uniqueBricks.add(b);
                if (b.type === 'FoodStorage') {
                    storageBricks.push(b);
                }
            }
        }
    }

    let targetBrick = null;
    let min_dist_sq = Infinity;

    storageBricks.forEach(storage => {
        const distSq = (storage.c - brick.c)**2 + (storage.r - brick.r)**2;
        if (distSq < min_dist_sq) {
            min_dist_sq = distSq;
            targetBrick = storage;
        }
    });

    const startPos = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
    let endPos;

    if (targetBrick) {
        endPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
    } else {
        const rect = dom.foodBankEl.getBoundingClientRect();
        const canvasRect = p.canvas.getBoundingClientRect();
        endPos = p.createVector(
            rect.left - canvasRect.left + rect.width / 2,
            rect.top - canvasRect.top + rect.height / 2
        );
    }
    
    const count = Math.ceil(amountToHarvest);
    const unitAmount = amountToHarvest / count;
    
    for (let i = 0; i < count; i++) {
        flyingIcons.push(new FlyingIcon(p, startPos, endPos, '🥕', {
            size: board.gridUnitSize * 0.4,
            lifespan: 30 + p.random(10),
            onComplete: () => {
                state.playerFood = Math.min(state.maxFood, state.playerFood + unitAmount);
            }
        }));
    }
    sounds.foodCollect();
}

export function harvestWood(brick, { homeBaseBricks, board, p, flyingIcons, gameController }) {
    if (brick.type !== 'LogBrick') return;

    const woodValue = 10;
    const spaceAvailable = Math.max(0, state.maxWood - state.playerWood);
    if (spaceAvailable < woodValue) {
        if(gameController?.addFloatingText) gameController.addFloatingText("Wood storage full!", {levels: [255,100,100]}, {isBold: true});
        return;
    }

    const rootC = brick.c + 6;
    const rootR = brick.r + 6;
    homeBaseBricks[rootC][rootR] = null;

    let storageBricks = [];
    const uniqueBricks = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const b = homeBaseBricks[c][r];
            if (b && !uniqueBricks.has(b)) {
                uniqueBricks.add(b);
                if (b.type === 'WoodStorage') {
                    storageBricks.push(b);
                }
            }
        }
    }

    let targetBrick = null;
    let min_dist_sq = Infinity;

    storageBricks.forEach(storage => {
        const distSq = (storage.c - brick.c)**2 + (storage.r - brick.r)**2;
        if (distSq < min_dist_sq) {
            min_dist_sq = distSq;
            targetBrick = storage;
        }
    });

    const startPos = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
    let endPos;

    if (targetBrick) {
        endPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
    } else {
        const rect = dom.woodBankEl.getBoundingClientRect();
        const canvasRect = p.canvas.getBoundingClientRect();
        endPos = p.createVector(
            rect.left - canvasRect.left + rect.width / 2,
            rect.top - canvasRect.top + rect.height / 2
        );
    }

    flyingIcons.push(new FlyingIcon(p, startPos, endPos, '🪵', {
        size: board.gridUnitSize * 0.4,
        lifespan: 30 + p.random(10),
        onComplete: () => {
            state.playerWood = Math.min(state.maxWood, state.playerWood + woodValue);
        }
    }));
    
    sounds.woodCollect();
    sounds.brickBreak();
}

/**
 * Centered logic for resource collection during runs.
 * Handles float storage, inventory caps, and the conversion skill.
 */
export function collectRunResource(p, type, amount, centerVec, context) {
    const { state, gameController, runStats, levelStats, floatingTexts } = context;
    const isFood = type === 'food';
    const playerKey = isFood ? 'playerFood' : 'playerWood';
    const maxKey = isFood ? 'maxFood' : 'maxWood';
    const runStatsKey = isFood ? 'totalFoodCollected' : 'totalWoodCollected';
    const levelStatsKey = isFood ? 'foodCollected' : 'woodCollected';
    const accumKey = isFood ? 'food' : 'wood';
    const color = isFood ? p.color(232, 159, 35) : p.color(139, 69, 19);
    const icon = isFood ? '🥕' : '🪵';
    const particleFn = isFood ? animateFoodParticles : animateWoodParticles;
    const soundFn = isFood ? sounds.foodCollect : sounds.woodCollect;

    let toPlayer = 0;
    let excess = 0;

    if (state.gameMode === 'adventureRun' && state.skillTreeState['resource_conversion']) {
        const currentRunTotal = (runStats ? runStats[runStatsKey] : 0) + (levelStats[levelStatsKey] || 0);
        const runLimit = state.runResourceSpace?.[accumKey] || Infinity;
        const storageSpace = Math.max(0, state[maxKey] - state[playerKey]);
        
        // Potential space is limited by storage AND the run's allotted capacity
        const totalPotentialSpace = Math.min(storageSpace, Math.max(0, runLimit - currentRunTotal));
        
        toPlayer = Math.min(amount, totalPotentialSpace);
        excess = amount - toPlayer;

        state[playerKey] += toPlayer; // Keep as float
        state.excessResourceAccumulator[accumKey] += excess;

        // Handle Coin conversion: 10 units = 1 Coin
        let coinsToAward = Math.floor(state.excessResourceAccumulator[accumKey] / 10);
        if (coinsToAward > 0) {
            gameController.addCoins(coinsToAward);
            // Subtract floored units to keep fractional remainder
            state.excessResourceAccumulator[accumKey] -= (coinsToAward * 10);
            if (floatingTexts) floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y - 15, `+${coinsToAward} 🪙`, p.color(255, 215, 0), { isBold: true }));
        }
    } else {
        // Standard collection (e.g. Home Base or Run without skill)
        toPlayer = Math.min(amount, Math.max(0, state[maxKey] - state[playerKey]));
        state[playerKey] += toPlayer;
    }

    if (toPlayer > 0) {
        if (state.gameMode === 'adventureRun' || state.gameMode === 'trialRun') {
            levelStats[levelStatsKey] = (levelStats[levelStatsKey] || 0) + toPlayer;
            if (runStats) runStats[runStatsKey] = (runStats[runStatsKey] || 0) + toPlayer;
        }
        
        soundFn();
        const displayVal = Math.floor(toPlayer);
        // Display floored integer, only show if at least 1 unit
        if (displayVal >= 1 && floatingTexts) {
            floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, `+${displayVal} ${icon}`, color));
        }
        const r = p.canvas.getBoundingClientRect();
        particleFn(r.left + centerVec.x, r.top + centerVec.y, Math.min(Math.ceil(toPlayer), 10));
    }
}

export function processBrokenBricks(lastBrickHitEvent, context) {
    const { p, board, bricks, splatBuffer, ballsInPlay, miniBalls, sharedBallStats, levelStats, floatingTexts, shockwaves, sounds, gameStateRef, ballsLeftRef, BRICK_STATS, gameController, runStats } = context;

    let chainReaction = true;
    while (chainReaction) {
        chainReaction = false;
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = bricks[c][r];
                if (brick && brick.isBroken()) {
                    event.dispatch('BrickDestroyed', { brick: brick, sourceBall: lastBrickHitEvent?.source });

                    const brickPos = brick.getPixelPos(board);
                    createSplat(p, splatBuffer, brickPos.x + brick.size / 2, brickPos.y + brick.size / 2, brick.getColor(), board.gridUnitSize);
                    const debris = createBrickHitVFX(p, brickPos.x + brick.size / 2, brickPos.y + brick.size / 2, brick.getColor());
                    context.particles.push(...debris);

                    const centerVec = p.createVector(
                        brickPos.x + (brick.size * brick.widthInCells) / 2,
                        brickPos.y + (brick.size * brick.heightInCells) / 2
                    );
                    
                    if (state.gameMode === 'adventureRun' || state.gameMode === 'trialRun') {
                        let evoTier = 1;
                        if (lastBrickHitEvent && lastBrickHitEvent.source) {
                            let sourceType = lastBrickHitEvent.source.type;
                            if (lastBrickHitEvent.source instanceof MiniBall) {
                                sourceType = lastBrickHitEvent.source.parentType;
                            } else if (lastBrickHitEvent.source.sourceBallType) { 
                                sourceType = lastBrickHitEvent.source.sourceBallType; 
                            }
                            
                            if (!BALL_STATS.types[sourceType]) sourceType = state.selectedBallType;
                            evoTier = BALL_STATS.types[sourceType]?.evoTier || 1;
                        }
                        
                        const chargeGain = CHARGE_SETTINGS.gainPerBrick[evoTier] || 16;
                        state.runCharge = Math.min(state.runCharge + chargeGain, state.runMaxCharge);
                    }
                    
                    if (state.gameMode === 'trialRun' && brick.overlay === 'laser') {
                         if (runStats) {
                             runStats.totalFuelCollected = (runStats.totalFuelCollected || 0) + 1;
                             if (floatingTexts) floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, '+1 🧊', p.color(173, 216, 230), { isBold: true }));
                             renderTrialLootPanel();
                         }
                    }
                    
                    if (state.gameMode !== 'invasionDefend') {
                        const orbsToSpawn = Math.floor(brick.maxHealth / XP_SETTINGS.xpPerOrb);
                        p.spawnXpOrbs(orbsToSpawn, centerVec);
                    }
                    
                    // --- RESOURCE COLLECTION (FOOD & WOOD) ---
                    if (brick.food > 0 || brick.type === 'LogBrick') {
                        const isFood = brick.food > 0;
                        const resourceAmount = isFood ? brick.food : 10;
                        collectRunResource(p, isFood ? 'food' : 'wood', resourceAmount, centerVec, { state, gameController, runStats, levelStats, floatingTexts });
                    }
                    
                    if (lastBrickHitEvent && lastBrickHitEvent.brick === brick && lastBrickHitEvent.source instanceof Ball && lastBrickHitEvent.source.type === 'cell') {
                        const cellBall = lastBrickHitEvent.source;
                        const angle = p.random(p.TWO_PI);
                        const speed = cellBall.vel.mag();
                        const v = p.constructor.Vector.fromAngle(angle).mult(speed);
                        const miniBallInstance = new MiniBall(p, cellBall.pos.x, cellBall.pos.y, v, board.gridUnitSize, 'cell', cellBall.instanceId); 
                        miniBalls.push(miniBallInstance);
                        sounds.split();
                    }

                    switch (brick.type) {
                        case 'extraBall': context.ballsLeftRef.value++; sounds.ballGained(); if (floatingTexts) floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, "+1 Ball", p.color(0, 255, 127))); break;
                        case 'explosive': p.explode(centerVec, board.gridUnitSize * BRICK_STATS.explosive.radiusTiles, Math.floor(state.upgradeableStats.explosiveBrickDamage), 'chain-reaction'); break;
                        case 'horizontalStripe': p.clearStripe(brick, 'horizontal'); break;
                        case 'verticalStripe': p.clearStripe(brick, 'vertical'); break;
                        case 'ballCage':
                            if (ballsInPlay.length > 0 && lastBrickHitEvent && lastBrickHitEvent.sourceBallVel) {
                                const mainBall = ballsInPlay[0];
                                const newBall = new Ball(p, centerVec.x, centerVec.y, mainBall.type, board.gridUnitSize, state.upgradeableStats);
                                newBall.vel = lastBrickHitEvent.sourceBallVel.copy();
                                newBall.isMoving = true;
                                newBall.powerUpUses = sharedBallStats.uses;
                                newBall.powerUpMaxUses = sharedBallStats.maxUses;
                                newBall.hp = sharedBallStats.hp;
                                newBall.maxHp = sharedBallStats.maxHp;
                                ballsInPlay.push(newBall);
                                sounds.split();
                            }
                            break;
                        case 'equipment':
                            const ownedIds = state.playerEquipment.map(eq => eq.id);
                            const newEquipment = generateRandomEquipment(ownedIds);
                            if (newEquipment) {
                                state.playerEquipment.push(newEquipment);
                                state.discoveredEquipment.add(newEquipment.id); 
                                dom.runEquipmentBtn.classList.add('glow');
                                levelStats.equipmentsCollected++;
                                const text = `${newEquipment.name} (${newEquipment.rarity})`;
                                let color; let glow = false;
                                switch (newEquipment.rarity) {
                                    case 'Common': color = p.color(255, 255, 255); break;
                                    case 'Rare': color = p.color(75, 141, 248); break;
                                    case 'Epic': color = p.color(164, 96, 248); glow = true; break;
                                    default: color = p.color(255);
                                }
                                p.addFloatingText(text, color, { size: 18, isBold: true, lifespan: 150, glow }, centerVec);
                            } else {
                                const xpBonus = 1000;
                                state.pendingXp += xpBonus;
                                if (floatingTexts) floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, `+${Math.floor(xpBonus)} XP!`, p.color(0, 229, 255), { size: 18, isBold: true, lifespan: 150 }));
                            }
                            sounds.equipmentGet();
                            shockwaves.push(new Shockwave(p, centerVec.x, centerVec.y, board.gridUnitSize * 3, p.color(255, 105, 180), 10));
                            break;
                    }
                    for(let i=0; i<brick.widthInCells; i++) {
                        for(let j=0; j<brick.heightInCells; j++) {
                            bricks[c+i][r+j] = null;
                        }
                    }
                    chainReaction = true;
                }
            }
        }
    }
    
    let goalBricksLeft = 0;
    for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) if (bricks[c][r] && bricks[c][r].type === 'goal') goalBricksLeft++;

    if (context.gameStateRef.value === 'playing' && goalBricksLeft === 0) {
        context.gameStateRef.value = 'levelClearing';
    }
}
