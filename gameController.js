
// gameController.js
import { UNLOCK_LEVELS, GRID_CONSTANTS, INITIAL_UPGRADE_STATE, BRICK_STATS, NPC_BALL_STATS, INVASION_MODE_PARAMS, ENCHANTER_STATS, INVASION_SHOP_ITEMS, EQUIPMENT_RARITY_WEIGHTS, DEFAULT_INVASION_SETTINGS, BALL_STATS } from './balancing.js';
import { BRICK_LEVELING_DATA, OVERLAY_LEVELING_DATA } from './brickLeveling.js';
import { Ball, calculateBallDamage } from './ball.js';
import { Brick } from './brick.js';
import { generateLevel } from './levelgen.js';
import { sounds } from './sfx.js';
import { Particle, Shockwave, FloatingText, LeechHealVFX, createBallDeathVFX, createBrickHitVFX, LootOrb } from './vfx.js';
import * as ui from './ui/index.js';
import { applyAllUpgrades } from './state.js';
import * as dom from './dom.js';
import * as event from './eventManager.js';
import * as equipmentManager from './equipmentManager.js';
import * as levelEditor from './levelEditor.js';
import { exportLevelToString } from './levelExporter.js';
import { importLevelFromString } from './levelImporter.js';
import { MILESTONE_LEVELS } from './firstTimeLevels.js';
import { harvestFood, harvestWood, processBrokenBricks } from './brickLogic.js';
import { explode, clearStripe } from './explosionLogic.js';
import { spawnHomingProjectile, spawnWallBullets } from './spawnProjectile.js';
import { NPCBall } from './npcBall.js';
import { generateMysteryShopItems } from './ui/invasionShop.js';
import { fireLasers, checkAndUnlockBalls } from './gameUtils.js';
import { createEquipment, RARITIES } from './equipment.js';

export function setupController(p, context, state) {
    p.getBoard = () => context.board;
    p.getBricks = () => context.bricks;
    p.getHomeBaseBricks = () => context.homeBaseBricks;
    p.setHomeBaseBricks = (bricks) => { context.homeBaseBricks = bricks; };
    p.getCoins = () => context.coins;
    p.setCoins = (newCoins) => { context.coins = newCoins; };
    p.getGameState = () => context.gameState;
    p.getLevelStats = () => context.levelStats;
    p.getRunStats = () => context.runStats;
    p.setRunStats = (newStats) => { context.runStats = newStats; };
    p.getSelectedBrick = () => context.selectedBrick;
    
    // --- Safe VFX Spawning ---
    p.spawnShockwave = (x, y, radius, color) => {
        context.shockwaves.push(new Shockwave(p, x, y, radius, color, 5));
    };

    p.addFloatingText = (text, color, options, position = null) => {
        const pos = position ? position.copy() : p.createVector(context.board.x + context.board.width / 2, context.board.y + context.board.height / 2);
        context.floatingTexts.push(new FloatingText(p, pos.x, pos.y, text, color, options));
    };

    // --- State Mutation Methods ---
    
    p.addBall = () => { context.ballsLeft++; state.ballPurchaseCount++; };
    p.addGiantBall = () => { context.giantBallCount++; };
    p.triggerGoldenShot = () => { state.isGoldenTurn = true; };
    
    p.toggleSpeed = () => { 
        state.isSpedUp = !state.isSpedUp; 
        p.setBallSpeedMultiplier(state.originalBallSpeed);
        return state.isSpedUp; 
    };

    p.toggleDebugView = (forceOff = false) => {
        if (forceOff) {
            state.isDebugView = false;
        } else {
            state.isDebugView = !state.isDebugView;
        }
        
        dom.debugStatsContainer.classList.toggle('hidden', !state.isDebugView);
        dom.cheatButtonsContainer.classList.toggle('hidden', !state.isDebugView);
        dom.debugViewBtn.textContent = state.isDebugView ? 'Debug Off' : 'Debug View';
        
        if (state.isDebugView) {
            ui.updateCheatButtonsVisibility();
            dom.toggleEventLog.checked = state.showEventLogDebug;
            dom.toggleEquipmentDebug.checked = state.showEquipmentDebug;
        }
    };

    p.forceEndTurn = () => {
        if (context.gameState === 'playing' || context.gameState === 'levelClearing') {
            context.ballsInPlay = [];
            context.miniBalls = [];
            context.projectiles = [];
        }
    };

    p.setBallSpeedMultiplier = (multiplier) => {
        state.originalBallSpeed = multiplier; 
        if (!context.board.gridUnitSize) return;
        
        let speedMultiplier = 1.0;
        
        // Find equipment from active ball OR selected loadout
        let equipment = [];
        if (context.ballsInPlay.length > 0) {
            equipment = context.ballsInPlay[0].getActiveEquipment();
        } else {
            // Check active type from state
            const type = state.selectedBallType;
            const instanceId = state.currentLoadout.find(id => {
                const b = state.ballInventory.find(bi => bi.instanceId === id);
                return b && b.type === type;
            });
            if (instanceId && state.ballEquipment[instanceId]) {
                 equipment = state.ballEquipment[instanceId].filter(Boolean);
            } else if (state.ballEquipment[type]) {
                 equipment = state.ballEquipment[type].filter(Boolean);
            }
        }
        
        const slowBall = equipment.find(item => item.id === 'slow_ball');
        if (slowBall) speedMultiplier *= slowBall.value;
        const gasTech = equipment.find(item => item.id === 'gas_tech');
        if (gasTech) speedMultiplier *= gasTech.value.speed;

        const baseSpeed = (context.board.gridUnitSize * 0.5) * state.originalBallSpeed * speedMultiplier;
        context.ballsInPlay.forEach(b => { if (b.isMoving) b.vel.setMag(baseSpeed); });
        context.miniBalls.forEach(mb => mb.vel.setMag(baseSpeed)); 
    };
    
    p.getBallSpeedMultiplier = () => state.originalBallSpeed;

    p.changeBallType = (newType) => {
        if (context.gameState === 'aiming' && context.ballsInPlay.length > 0) {
            const oldPos = context.ballsInPlay[0].pos.copy();
            
            let instanceId = null;
            const matchingId = state.currentLoadout.find(id => {
                 const b = state.ballInventory.find(bi => bi.instanceId === id);
                 return b && b.type === newType;
            });
            if (matchingId) instanceId = matchingId;

            const newBall = new Ball(p, oldPos.x, oldPos.y, newType, context.board.gridUnitSize, state.upgradeableStats, { instanceId });
            context.ballsInPlay[0] = newBall;
            
            context.sharedBallStats = {
                hp: newBall.hp,
                maxHp: newBall.maxHp,
                uses: newBall.powerUpUses,
                maxUses: newBall.powerUpMaxUses,
                flashTime: 0
            };
            p.setBallSpeedMultiplier(state.originalBallSpeed);
        }
    };
    
    p.killAllNPCs = () => {
        context.npcBalls.forEach(b => b.takeDamage(999999));
    };
    
    p.levelUpInvasionBricks = () => {
        if (state.gameMode !== 'invasionDefend') return;
        
        const bricks = context.bricks;
        const processed = new Set();
        let upgradedCount = 0;

        for (let c = 0; c < context.board.cols; c++) {
            for (let r = 0; r < context.board.rows; r++) {
                const brick = bricks[c][r];
                if (brick && !processed.has(brick)) {
                    processed.add(brick);
                    
                    const nextLevelData = BRICK_LEVELING_DATA[brick.type]?.[brick.level];
                    if (nextLevelData) {
                        brick.level++;
                        Object.assign(brick, nextLevelData.stats);
                        upgradedCount++;
                        
                        const pos = brick.getPixelPos(context.board).add(brick.size/2, brick.size/2);
                        context.particles.push(new Particle(p, pos.x, pos.y, p.color(100, 255, 255), 2, { lifespan: 40 }));
                    } else {
                        brick.maxHealth += 20;
                        brick.health += 20;
                        upgradedCount++;
                    }
                    
                    if (brick.overlayId || brick.overlay) {
                        if (brick.overlay === 'spike') brick.retaliateDamage += 5;
                    }
                }
            }
        }
        
        p.addFloatingText(`Upgraded ${upgradedCount} Bricks!`, p.color(0, 255, 255), { isBold: true, size: 24 });
        sounds.upgrade();
    };

    p.resetGame = async (settings, startLevel = 1) => {
        context.gameState = 'loading'; 
        state.gameMode = 'adventureRun';
        ui.updateUIVisibilityForMode('adventureRun');
        ui.updateCheatButtonsVisibility();

        if (!Array.isArray(state.currentLoadout) || state.currentLoadout.length !== 7) {
             state.currentLoadout = [null, null, null, null, null, null, null];
        }

        if (state.ballInventory.length === 0) {
            const instanceId = crypto.randomUUID();
            const newBall = {
                instanceId: instanceId,
                type: 'classic',
                name: 'Classic Ball',
                level: 1,
                outcomes: [],
                costMultipliers: [],
                stats: {}, 
                isFavorite: false,
                obtainedAt: Date.now()
            };
            state.ballInventory.push(newBall);
            state.currentLoadout[0] = instanceId;
        }
        
        checkAndUnlockBalls(state);
        
        if (state.skillTreeState['resource_conversion']) {
            state.runResourceSpace = {
                food: Math.max(0, state.maxFood - state.playerFood),
                wood: Math.max(0, state.maxWood - state.playerWood)
            };
        } else {
            state.runResourceSpace = { food: 0, wood: 0 };
        }
        state.excessResourceAccumulator = { food: 0, wood: 0 };

        p.setBallSpeedMultiplier(settings.ballSpeed);
        context.level = startLevel; 
        
        let startingCoinBonus = 0;
        if (state.skillTreeState['starting_coin_1']) startingCoinBonus += 5;
        if (state.skillTreeState['starting_coin_2']) startingCoinBonus += 5;
        if (state.skillTreeState['starting_coin_3']) startingCoinBonus += 5;
        if (state.skillTreeState['starting_coin_4']) startingCoinBonus += 5;
        if (state.skillTreeState['starting_coin_5']) startingCoinBonus += 5;
        if (state.skillTreeState['starting_coin_6']) startingCoinBonus += 5;
        if (state.skillTreeState['starting_coin_7']) startingCoinBonus += 5;
        if (state.skillTreeState['starting_coin_8']) startingCoinBonus += 5;

        context.coins = startingCoinBonus;
        context.giantBallCount = 0; 
        context.combo = 0; 
        context.maxComboThisTurn = 0;
        context.isGiantBallTurn = false; 
        context.runMaxCombo = 0;
        state.isGoldenTurn = false;
        state.ballPurchaseCount = 0;
        state.equipmentPurchaseCount = 0;
        state.runCharge = 0; 
        state.firstEquipmentGained = false; // RESET FIRST EQUIPMENT FLAG
        state.upgradeState = JSON.parse(JSON.stringify(INITIAL_UPGRADE_STATE));
        applyAllUpgrades();
        state.equipmentBrickSpawnChance = settings.equipmentBrickInitialChance;

        if (state.skillTreeState['starting_equipment_brick']) {
            state.equipmentBrickSpawnChance = 1.0;
        }

        context.runStats = {
            totalBallsUsed: 0, totalDamageDealt: 0, totalEquipmentsCollected: 0,
            totalCoinsCollected: 0, totalXpCollected: 0, totalGemsCollected: 0,
            totalFoodCollected: 0, totalWoodCollected: 0, bestCombo: 0,
        };

        state.playerEquipment = [];
        for (const ballType in state.ballEquipment) {
            state.ballEquipment[ballType] = [null, null, null];
        }

        let baseBalls = 3;
        if(state.skillTreeState['starting_ball']) baseBalls++;
        context.ballsLeft = baseBalls;
        
        context.splatBuffer.clear();
        await p.runLevelGeneration(settings);
        
        ui.updateBallSelectorUI(state.mainLevel, context.ballsLeft, context.giantBallCount, context.gameState);
        
        context.gameState = 'aiming'; 
    };

    p.enterHomeBase = () => {
        state.gameMode = 'homeBase';
        context.gameState = 'loading';
        
        checkAndUnlockBalls(state);
        
        const loadAndSetup = async () => {
            if (!state.isInitialHomeBaseLayoutLoaded) {
                try {
                    const response = await fetch('levels/homebase_layout.txt');
                    if (response.ok) {
                        const layoutData = await response.text();
                        const importedBricks = importLevelFromString(layoutData, p, context.board);
                        if (importedBricks) {
                            context.homeBaseBricks = importedBricks;
                        }
                    } else {
                        console.error("homebase_layout.txt not found, starting with empty base.");
                    }
                } catch (error) {
                    console.error("Failed to load initial home base layout:", error);
                }
                state.isInitialHomeBaseLayoutLoaded = true;
            }

            context.bricks = context.homeBaseBricks; 
            context.selectedBrick = null;
            event.dispatch('BrickSelected', { brick: null });
            
            context.ballsInPlay = []; context.miniBalls = []; context.projectiles = []; context.ghostBalls = []; 
            context.xpOrbs = []; context.lootOrbs = []; context.lasers = []; context.npcBalls = []; context.breadCrumbs = [];
            context.particles = []; context.shockwaves = []; context.floatingTexts = []; context.powerupVFXs = []; 
            context.stripeFlashes = []; context.leechHealVFXs = []; context.zapperSparkles = [];
            context.delayedActionsQueue = []; context.endTurnActions = [];
            context.flyingIcons = [];

            context.combo = 0; context.maxComboThisTurn = 0; context.isGiantBallTurn = false;
            
            context.splatBuffer.clear();
            ui.updateUIVisibilityForMode('homeBase');
            ui.updateCheatButtonsVisibility();
            p.recalculateMaxResources();
            
            context.shakeAmount = 0;
            context.shakeDuration = 0;
            
            context.gameState = 'aiming';
        };

        loadAndSetup();
    };

    p.startTrialRun = async (ballStock) => {
        state.gameMode = 'trialRun';
        ui.updateUIVisibilityForMode('trialRun');
        ui.updateCheatButtonsVisibility();
        state.trialRunBallStock = ballStock;
    
        const firstAvailableType = Object.keys(state.trialRunBallStock).find(type => state.trialRunBallStock[type] > 0);
        state.selectedBallType = firstAvailableType || 'classic';
    
        context.level = 1;
        context.coins = 0;
        context.giantBallCount = 0;
        context.combo = 0;
        context.maxComboThisTurn = 0;
        context.isGiantBallTurn = false;
        context.runMaxCombo = 0;
        state.isGoldenTurn = false;
        state.ballPurchaseCount = 0;
        state.equipmentPurchaseCount = 0;
        state.runCharge = 0; 
        state.firstEquipmentGained = false; // RESET FIRST EQUIPMENT FLAG
        state.upgradeState = JSON.parse(JSON.stringify(INITIAL_UPGRADE_STATE));
        applyAllUpgrades();
        state.equipmentBrickSpawnChance = 0;
    
        context.runStats = {
            totalBallsUsed: 0, totalDamageDealt: 0, totalEquipmentsCollected: 0,
            totalCoinsCollected: 0, totalXpCollected: 0, totalGemsCollected: 0,
            totalFoodCollected: 0, totalWoodCollected: 0, totalMetalCollected: 0,
            totalWireCollected: 0, totalFuelCollected: 0, bestCombo: 0,
        };
    
        state.playerEquipment = [];
        if (state.discoveredEquipment && state.discoveredEquipment.size > 0) {
            const weights = state.skillTreeState['better_loot_luck'] 
                ? EQUIPMENT_RARITY_WEIGHTS.upgraded 
                : EQUIPMENT_RARITY_WEIGHTS.base;
            const totalWeight = weights.common + weights.rare + weights.epic;

            state.playerEquipment = Array.from(state.discoveredEquipment).map(id => {
                let r = Math.random() * totalWeight;
                let rarity = RARITIES.COMMON;
                if (r < weights.epic) {
                    rarity = RARITIES.EPIC;
                } else {
                    r -= weights.epic;
                    if (r < weights.rare) {
                        rarity = RARITIES.RARE;
                    }
                }
                return createEquipment(id, rarity);
            }).filter(Boolean);
        }

        for (const ballType in state.ballEquipment) {
            state.ballEquipment[ballType] = [null, null, null];
        }
        
        context.ballsLeft = 0;
        context.splatBuffer.clear();
        await p.runLevelGeneration(state.trialRunLevelSettings);
    };

    p.nextLevel = async () => { 
        context.level++; 
        const settings = state.gameMode === 'trialRun' ? state.trialRunLevelSettings : ui.getLevelSettings();
        await p.runLevelGeneration(settings); 
    };

    p.prevLevel = async () => { 
        if (context.level > 1) { 
            context.level--; 
            const settings = state.gameMode === 'trialRun' ? state.trialRunLevelSettings : ui.getLevelSettings();
            await p.runLevelGeneration(settings); 
        } 
    };

    p.runLevelGeneration = async (settings) => {
        const milestoneFile = MILESTONE_LEVELS[context.level];
        if (state.gameMode !== 'trialRun' && milestoneFile && !state.milestonesCompleted[context.level]) {
            try {
                const response = await fetch(milestoneFile);
                if (response.ok) {
                    const levelData = await response.text();
                    const importedBricks = importLevelFromString(levelData, p, context.board);
                    if (importedBricks) {
                        context.bricks = importedBricks;
                        context.currentSeed = `milestone_${context.level}`;
                        context.levelHpPool = 0; context.levelHpPoolSpent = 0; context.levelCoinPool = 0; context.levelGemPool = 0;
                        context.equipmentBrickSpawnedThisLevel = false;
                        
                        resetLevelState();
                        fireLasers(context); 
                        return;
                    }
                }
            } catch (error) {
                console.error(`Failed to load milestone level ${context.level}:`, error);
            }
        }
        
        const result = generateLevel(p, settings, context.level, context.board);
        context.bricks = result.bricks;
        context.currentSeed = result.seed;
        context.levelHpPool = result.hpPool;
        context.levelHpPoolSpent = result.hpPoolSpent;
        context.levelCoinPool = result.coinPool;
        context.levelGemPool = result.gemPool;
        context.equipmentBrickSpawnedThisLevel = result.equipmentBrickSpawned;
        
        resetLevelState();
        fireLasers(context);
    };

    function resetLevelState() {
        context.ballsInPlay = []; context.miniBalls = []; context.projectiles = []; context.ghostBalls = []; 
        context.lootOrbs = []; context.xpOrbs = []; context.lasers = []; context.breadCrumbs = [];
        context.delayedActionsQueue = []; context.endTurnActions = [];
        context.endTurnActionTimer = 0; context.zapperAuraTimer = 0; context.zapperSparkles = [];
        context.flyingIcons = [];
        context.gameState = 'aiming';
        context.levelCompleteSoundPlayed = false; context.gameOverSoundPlayed = false;
        context.combo = 0; context.maxComboThisTurn = 0; context.isGiantBallTurn = false;
        state.isGoldenTurn = false;
        context.orbsCollectedThisTurn = 0; context.xpCollectPitchResetTimer = 0;
        state.wallExplosionCharge = 0; state.invulnerabilityTimer = 0; state.rampingDamage = 0; state.rampingDamageTimer = 0;
        state.orbsForHeal = 0; state.hpLostForRetaliation = 0; state.coinsForDuplication = 0;
        state.phaserCharges = 0; state.zapAuraTimer = 0; state.overflowHealCharges = 0;
        state.lastStandCharges = 0; state.orbsForLastStand = 0;
        state.overchargeParticles = []; state.comboParticles = [];
        
        context.shakeAmount = 0;
        context.shakeDuration = 0;

        context.levelStats = {
            ballsUsed: 0, totalDamage: 0, maxDamageInTurn: 0, damageThisTurn: 0,
            coinsCollected: 0, xpCollected: 0, equipmentsCollected: 0,
            gemsCollected: 0, foodCollected: 0, woodCollected: 0,
        };
    }

    p.startInvasionDefend = async () => {
        state.gameMode = 'invasionDefend';
        ui.updateUIVisibilityForMode('invasionDefend');
    
        state.invasionWave = 0; 
        state.invasionSettings = DEFAULT_INVASION_SETTINGS; 
        state.invasionBallHPPool = state.invasionSettings.startingHPPool;
        context.npcBalls = []; context.xpOrbs = []; context.lootOrbs = []; context.ballsInPlay = [];
        context.invasionSpawningQueue = []; context.npcSpawnTimer = 0; context.breadCrumbs = [];

        context.runStats = {
            totalXpCollected: 0, invasionRunCoins: 0, invasionShopPurchases: {},
            ect3Chance: 0,
            enchantersCollected: { enchanter1: 0, enchanter2: 0, enchanter3: 0, enchanter4: 0, enchanter5: 0 },
            mysteryShopItems: null,
            shellsCollected: 0
        };
        INVASION_SHOP_ITEMS.forEach(item => { context.runStats.invasionShopPurchases[item.id] = 0; });
    
        const snapshotBricks = Array(context.board.cols).fill(null).map(() => Array(context.board.rows).fill(null));
        const sourceBricks = context.homeBaseBricks;
        const processed = new Set();
        const invalidTypes = ['LogBrick'];
        for (let c = 0; c < context.board.cols; c++) {
            for (let r = 0; r < context.board.rows; r++) {
                const sourceBrick = sourceBricks[c][r];
                if (sourceBrick && !processed.has(sourceBrick)) {
                    processed.add(sourceBrick);
                    if (!invalidTypes.includes(sourceBrick.type)) {
                        const newBrick = new Brick(p, sourceBrick.c, sourceBrick.r, sourceBrick.type, sourceBrick.maxHealth, context.board.gridUnitSize, sourceBrick.level);
                        Object.keys(sourceBrick).forEach(key => {
                            if (key === 'p') return; 
                            const value = sourceBrick[key];
                            if (key.endsWith('IndicatorPositions') && Array.isArray(value) && value.length > 0 && value[0].copy) {
                                newBrick[key] = value.map(v => v.copy());
                            } else if ((key === 'production' || key === 'inventory') && typeof value === 'object' && value !== null) {
                                newBrick[key] = JSON.parse(JSON.stringify(value));
                            } else if (typeof value !== 'function') {
                                newBrick[key] = value;
                            }
                        });
                        newBrick.health = newBrick.maxHealth;
                        newBrick.coins = 0; newBrick.maxCoins = 0; newBrick.food = 0; newBrick.maxFood = 0; newBrick.gems = 0; newBrick.maxGems = 0;
                        const rootC = newBrick.c + 6;
                        const rootR = newBrick.r + 6;
                        for(let i=0; i<newBrick.widthInCells; i++) for(let j=0; j<newBrick.heightInCells; j++) snapshotBricks[rootC + i][rootR + j] = newBrick;
                    }
                }
            }
        }
        context.bricks = snapshotBricks;
        await p.startNextWave();
    };

    p.startNextWave = async () => {
        context.npcBalls = [];
        context.lootOrbs = [];
        context.projectiles = [];
        context.breadCrumbs = [];
        
        fireLasers(context);
        dom.invasionShopUI.classList.add('hidden');
        context.gameState = 'playing';
        dom.invasionNextWaveBtn.classList.add('hidden');
        
        state.invasionWave++;
        if (state.invasionWave > 1) {
            state.invasionBallHPPool += state.invasionSettings.hpPoolIncrementPerWave;
        }

        p.addFloatingText(`Wave ${state.invasionWave} Initiated!`, p.color(255, 100, 100), { size: 40, isBold: true, lifespan: 120, vel: p.createVector(0,0), scaleRate: 0.005, glow: true });

        context.invasionSpawningQueue = []; 
        let currentHPPool = state.invasionBallHPPool;
        
        const possibleNpcTypes = Object.keys(NPC_BALL_STATS).filter(
            type => NPC_BALL_STATS[type].minWaveToAppear <= state.invasionWave
        );

        let availableNpcs = [];
        if (possibleNpcTypes.length > 0) {
            const { minEnemyTypes, maxEnemyTypes } = state.invasionSettings;
            const numTypesToUse = p.floor(p.random(minEnemyTypes, Math.min(maxEnemyTypes, possibleNpcTypes.length) + 1));
            p.shuffle(possibleNpcTypes, true);
            availableNpcs = possibleNpcTypes.slice(0, numTypesToUse);
        }

        const goalBricks = [];
        const processed = new Set();
        for (let c = 0; c < context.board.cols; c++) {
            for (let r = 0; r < context.board.rows; r++) {
                const brick = context.bricks[c][r];
                if (brick && !processed.has(brick) && brick.type === 'goal') {
                    goalBricks.push(brick);
                    processed.add(brick);
                }
            }
        }

        if (goalBricks.length === 0) {
            const centerC = Math.floor(context.board.cols / 2);
            const centerR = Math.floor(context.board.rows / 2);
            if (!context.bricks[centerC][centerR]) {
                const goalBrick = new Brick(p, centerC - 6, centerR - 6, 'goal', 10, context.board.gridUnitSize);
                context.bricks[centerC][centerR] = goalBrick;
                goalBricks.push(goalBrick);
            }
        }

        while (currentHPPool > 0) {
            const affordableNpcs = availableNpcs.filter(type => NPC_BALL_STATS[type].cost <= currentHPPool);
            if (affordableNpcs.length === 0) break;

            const npcType = p.random(affordableNpcs);
            const npcStats = NPC_BALL_STATS[npcType];
            currentHPPool -= npcStats.cost;

            let guaranteedDrop = null;
            if (context.runStats.ect3Chance > 0 && p.random() < context.runStats.ect3Chance) {
                guaranteedDrop = { type: 'enchanter3', amount: 1 };
                context.runStats.ect3Chance = 0;
            } else {
                context.runStats.ect3Chance += (npcStats.cost / 1000) * INVASION_MODE_PARAMS.ENCHANTER_DROP_RATE_PER_COST;
            }

            let x, y;
            const side = p.floor(p.random(4));
            if (side === 0) { x = p.random(context.board.x, context.board.x + context.board.width); y = context.board.y - 20; }
            else if (side === 1) { x = context.board.x + context.board.width + 20; y = p.random(context.board.y, context.board.y + context.board.height); }
            else if (side === 2) { x = p.random(context.board.x, context.board.x + context.board.width); y = context.board.y + context.board.height + 20; }
            else { x = context.board.x - 20; y = p.random(context.board.y, context.board.y + context.board.height); }
            const startPos = p.createVector(x, y);

            const targetBrick = p.random(goalBricks);
            if (!targetBrick) break;

            const targetPos = targetBrick.getPixelPos(context.board).add(targetBrick.size / 2, targetBrick.size / 2);
            const vel = p.constructor.Vector.sub(targetPos, startPos);
            const baseSpeed = (context.board.gridUnitSize * 0.5) * state.originalBallSpeed;
            vel.setMag(baseSpeed * npcStats.speedMultiplier);

            context.invasionSpawningQueue.push({ pos: startPos, vel, type: npcType, target: targetBrick, guaranteedEnchanterDrop: guaranteedDrop });
        }
    };
    
    p.exportLevelData = () => exportLevelToString(context.bricks, context.board);
    
    p.importLevelData = (dataString, editorUndo = false) => {
        const newBricks = importLevelFromString(dataString, p, context.board);
        if (newBricks) {
            context.bricks = newBricks;
            if (!editorUndo) resetLevelState();
        }
    };
    
    p.toggleEditor = () => {
        const isNowEditing = levelEditor.toggle();
        if (isNowEditing) {
            context.selectedBrick = null;
            event.dispatch('BrickSelected', { brick: null });
        } else {
            resetLevelState();
        }
    };
    
    p.setEditorState = (type, value) => {
        if (type === 'tool' && value === 'removeAll') {
            levelEditor.pushUndoState();
            p.clearBricks();
        } else {
            levelEditor.setState(type, value);
        }
    };

    p.clearBricks = () => {
        context.bricks = Array(context.board.cols).fill(null).map(() => Array(context.board.rows).fill(null));
        context.shockwaves.push(new Shockwave(p, context.board.x + context.board.width / 2, context.board.y + context.board.height / 2, context.board.width, p.color(255, 0, 0), 20));
    };

    p.recalculateMaxResources = () => {
        let foodCapacity = 1000;
        let woodCapacity = 1000;
        const processedBricks = new Set();
        const bricksToCheck = context.homeBaseBricks;

        for (let c = 0; c < context.board.cols; c++) {
            for (let r = 0; r < context.board.rows; r++) {
                const brick = bricksToCheck[c][r];
                if (brick && !processedBricks.has(brick)) {
                    processedBricks.add(brick);
                    if (brick.type === 'FoodStorage') foodCapacity += brick.capacity;
                    else if (brick.type === 'WoodStorage') woodCapacity += brick.capacity;
                }
            }
        }
        state.maxFood = foodCapacity; state.maxWood = woodCapacity;
        state.playerFood = Math.min(state.playerFood, state.maxFood);
        state.playerWood = Math.min(state.playerWood, state.maxWood);
    };

    p.placeBrickInHomeBase = (brickType) => {
        let placed = false;
        for (let r = 0; r < context.board.rows; r++) {
            for (let c = 0; c < context.board.cols; c++) {
                if (!context.homeBaseBricks[c][r]) {
                    let health = BRICK_LEVELING_DATA[brickType]?.[0]?.stats.maxHealth ?? 10;
                    if (brickType === 'normal') health = 10; 
                    const newBrick = new Brick(p, c - 6, r - 6, brickType, health, context.board.gridUnitSize);
                    context.homeBaseBricks[c][r] = newBrick;

                    if (brickType === 'FoodStorage' || brickType === 'WoodStorage') p.recalculateMaxResources();
                    placed = true;
                    break; 
                }
            }
            if (placed) break;
        }
        return placed;
    };
    
    p.upgradeBrick = (brickToUpgrade) => {
        if (!brickToUpgrade || state.gameMode !== 'homeBase') return;

        const recipeData = BRICK_LEVELING_DATA[brickToUpgrade.type]?.[brickToUpgrade.level];
        if (!recipeData) return;

        let hasIngredients = true;
        for (const ing of recipeData.ingredients) {
            const availableCount = p.countBricks(b => 
                b.type === ing.type && b.level === ing.level && b.id !== brickToUpgrade.id && !b.overlayId
            );
            if (availableCount < ing.amount) { hasIngredients = false; break; }
        }
        
        const canAfford = (state.playerFood >= (recipeData.cost.food || 0)) && (state.playerWood >= (recipeData.cost.wood || 0));

        if (hasIngredients && canAfford) {
            for (const ing of recipeData.ingredients) {
                let consumed = 0;
                for (let c = 0; c < context.board.cols; c++) {
                    for (let r = 0; r < context.board.rows; r++) {
                        const brick = context.homeBaseBricks[c][r];
                        if (brick && brick.type === ing.type && brick.level === ing.level && brick.id !== brickToUpgrade.id && !brick.overlayId) {
                            context.homeBaseBricks[c][r] = null;
                            consumed++;
                            if (consumed >= ing.amount) break;
                        }
                    }
                    if (consumed >= ing.amount) break;
                }
            }
            
            state.playerFood -= (recipeData.cost.food || 0);
            state.playerWood -= (recipeData.cost.wood || 0);

            brickToUpgrade.level++;
            Object.assign(brickToUpgrade, recipeData.stats);
            if (brickToUpgrade.type === 'BallProducer') brickToUpgrade.production.maxQueue = recipeData.stats.maxQueue;
            if (brickToUpgrade.type === 'FoodStorage' || brickToUpgrade.type === 'WoodStorage') p.recalculateMaxResources();

            sounds.upgrade();
            event.dispatch('BrickSelected', { brick: brickToUpgrade });
        }
    };
    
    p.countBricks = (filterFn) => {
        const bricksToCheck = state.gameMode === 'homeBase' ? context.homeBaseBricks : context.bricks;
        const processed = new Set();
        let count = 0;
        for (let c = 0; c < context.board.cols; c++) {
            for (let r = 0; r < context.board.rows; r++) {
                const brick = bricksToCheck[c][r];
                if (brick && !processed.has(brick)) {
                    processed.add(brick);
                    if (filterFn(brick)) count++;
                }
            }
        }
        return count;
    };
    
    p.refundTrialRunBalls = () => {
        if (state.gameMode !== 'trialRun') return;
        let ballsToRefund = [];
        for (const ballType in state.trialRunBallStock) {
            for (let i = 0; i < state.trialRunBallStock[ballType]; i++) ballsToRefund.push(ballType);
        }
        if (ballsToRefund.length === 0) return;

        const emptyCages = [];
        const processedCages = new Set();
        for (let c = 0; c < context.board.cols; c++) {
            for (let r = 0; r < context.board.rows; r++) {
                const brick = context.homeBaseBricks[c][r];
                if (brick && brick.type === 'EmptyCage' && !processedCages.has(brick)) {
                    emptyCages.push(brick);
                    processedCages.add(brick);
                }
            }
        }
        
        let refundedCount = 0;
        emptyCages.sort((a, b) => b.inventory.length - a.inventory.length);
        
        for (const cage of emptyCages) {
            while (cage.inventory.length < cage.ballCapacity && ballsToRefund.length > 0) {
                cage.inventory.push(ballsToRefund.pop());
                refundedCount++;
            }
        }

        if (ballsToRefund.length > 0) p.addFloatingText(`${ballsToRefund.length} unused balls lost`, p.color(255, 100, 100), { isBold: true });
        if (refundedCount > 0) p.addFloatingText(`Refunded ${refundedCount} balls`, p.color(100, 255, 100), { isBold: true });
        state.trialRunBallStock = {};
    };

    p.placeBrickInInvasion = (brickType) => {
        let placed = false;
        const emptyCoords = [];
        for (let r = 0; r < context.board.rows; r++) for (let c = 0; c < context.board.cols; c++) if (!context.bricks[c][r]) emptyCoords.push({c, r});
        p.shuffle(emptyCoords, true);
        if (emptyCoords.length > 0) {
            const spot = emptyCoords[0];
            const health = BRICK_STATS.maxHp[brickType] || 10;
            context.bricks[spot.c][spot.r] = new Brick(p, spot.c - 6, spot.r - 6, brickType, health, context.board.gridUnitSize);
            placed = true;
        }
        return placed;
    };
    
    p.healInvasionBricks = (count) => {
        const allBricks = [];
        const processed = new Set();
        for (let c = 0; c < context.board.cols; c++) for (let r = 0; r < context.board.rows; r++) {
            const b = context.bricks[c][r];
            if (b && !processed.has(b) && b.health < b.maxHealth) { allBricks.push(b); processed.add(b); }
        }
        p.shuffle(allBricks, true);
        const targets = (count >= 999) ? allBricks : allBricks.slice(0, count);
        targets.forEach(b => {
            b.health = b.maxHealth;
            const pos = b.getPixelPos(context.board).add(b.size/2, b.size/2);
            context.particles.push(new Particle(p, pos.x, pos.y, p.color(100, 255, 100), 3, { lifespan: 40 }));
        });
        if (targets.length > 0) sounds.brickHeal();
    };
    
    p.buffInvasionHP = (amount) => {
        const allBricks = [];
        const processed = new Set();
        for (let c = 0; c < context.board.cols; c++) for (let r = 0; r < context.board.rows; r++) {
            const b = context.bricks[c][r];
            if (b && !processed.has(b)) { allBricks.push(b); processed.add(b); }
        }
        allBricks.forEach(b => {
            b.maxHealth += amount;
            b.health += amount;
            const pos = b.getPixelPos(context.board).add(b.size/2, b.size/2);
            context.particles.push(new Particle(p, pos.x, pos.y, p.color(100, 200, 255), 2, { lifespan: 30 }));
        });
        if (allBricks.length > 0) sounds.brickHeal();
    };

    p.addLoot = (type, amount) => {
        if (type === 'shell') {
            context.runStats.shellsCollected = (context.runStats.shellsCollected || 0) + amount;
            p.addFloatingText(`+${amount} 🐚`, p.color(255, 240, 200), { isBold: true, size: 20 });
            ui.renderInvasionLootPanel();
        } else {
            if (context.runStats.enchantersCollected) context.runStats.enchantersCollected[type] = (context.runStats.enchantersCollected[type] || 0) + amount;
            p.addFloatingText(`+${amount} ${ENCHANTER_STATS[type]?.name || 'Enchanter'}`, p.color(221, 191, 216), { isBold: true, size: 16 });
            sounds.enchanterCollect();
            ui.renderInvasionLootPanel();
        }
    };

    p.applyOverlayInInvasion = (overlayType, level = 1) => {
        let applied = false;
        const eligibleBricks = [];
        const processed = new Set();
        for (let c = 0; c < context.board.cols; c++) for (let r = 0; r < context.board.rows; r++) {
            const brick = context.bricks[c][r];
            if (brick && !processed.has(brick) && brick.type === 'normal' && !brick.overlay) { eligibleBricks.push(brick); processed.add(brick); }
        }
        p.shuffle(eligibleBricks, true);
        if (eligibleBricks.length > 0) {
            const targetBrick = eligibleBricks[0];
            targetBrick.overlay = overlayType;
            const stats = OVERLAY_LEVELING_DATA[overlayType]?.[level - 1]?.stats || {};
            if (overlayType === 'spike') targetBrick.retaliateDamage = stats.retaliateDamage || BRICK_STATS.spike.damage;
            if (overlayType === 'sniper') targetBrick.sniperCharge = 0;
            applied = true;
        }
        return applied;
    };
    
    p.killAllNPCs = () => {
        context.npcBalls.forEach(b => b.takeDamage(999999));
    };
    
    p.levelUpInvasionBricks = () => {
        if (state.gameMode !== 'invasionDefend') return;
        
        const bricks = context.bricks;
        const processed = new Set();
        let upgradedCount = 0;

        for (let c = 0; c < context.board.cols; c++) {
            for (let r = 0; r < context.board.rows; r++) {
                const brick = bricks[c][r];
                if (brick && !processed.has(brick)) {
                    processed.add(brick);
                    
                    const nextLevelData = BRICK_LEVELING_DATA[brick.type]?.[brick.level]; 
                    if (nextLevelData) {
                        brick.level++;
                        Object.assign(brick, nextLevelData.stats);
                        upgradedCount++;
                        
                        const pos = brick.getPixelPos(context.board).add(brick.size/2, brick.size/2);
                        context.particles.push(new Particle(p, pos.x, pos.y, p.color(100, 255, 255), 2, { lifespan: 40 }));
                    } else {
                        brick.maxHealth += 20;
                        brick.health += 20;
                        upgradedCount++;
                    }
                    
                    if (brick.overlayId || brick.overlay) {
                        if (brick.overlay === 'spike') brick.retaliateDamage += 5;
                    }
                }
            }
        }
        
        p.addFloatingText(`Upgraded ${upgradedCount} Bricks!`, p.color(0, 255, 255), { isBold: true, size: 24 });
        sounds.upgrade();
    };
    
    p.healBall = (amount) => {
        if (context.ballsInPlay.length > 0 && !context.ballsInPlay[0].isDying) {
            context.sharedBallStats.hp = Math.min(context.sharedBallStats.maxHp, context.sharedBallStats.hp + amount);
            sounds.ballHeal();
            const ball = context.ballsInPlay[0];
            if (ball.pos && typeof ball.radius === 'number') {
                context.leechHealVFXs.push(new LeechHealVFX(p, ball.pos.x, ball.pos.y, ball.radius));
            }
        }
    };
    
    p.addCoins = (amount) => {
        context.coins += amount;
        if(context.levelStats) context.levelStats.coinsCollected += amount;
        sounds.coin();
        if (context.ballsInPlay.length > 0) {
            const ball = context.ballsInPlay[0];
            const canvasRect = p.canvas.getBoundingClientRect();
            ui.animateCoinParticles(canvasRect.left + ball.pos.x, canvasRect.top + ball.pos.y, amount);
        }
    };
    
    p.explode = (pos, radius, damage, source) => {
        const explodeContext = { p, board: context.board, bricks: context.bricks, shockwaves: context.shockwaves, particles: context.particles, delayedActionsQueue: context.delayedActionsQueue, ballsInPlay: context.ballsInPlay, triggerShake: (a,b) => { context.shakeAmount = Math.max(context.shakeAmount, a); context.shakeDuration = Math.max(context.shakeDuration, b); }, sharedBallStats: context.sharedBallStats };
        explode(p, pos, radius, damage, source, explodeContext);
    };
    
    p.clearStripe = (brick, direction) => {
        const ctx = { board: context.board, bricks: context.bricks, stripeFlashes: context.stripeFlashes, particles: context.particles, delayedActionsQueue: context.delayedActionsQueue };
        clearStripe(p, brick, direction, ctx);
    };

    p.spawnHomingProjectile = (position, item, sourceBall = null) => {
        const srcBall = sourceBall || (context.ballsInPlay.length > 0 ? context.ballsInPlay[0] : null);
        spawnHomingProjectile(p, position, item, { board: context.board, bricks: context.bricks, projectiles: context.projectiles, ballsInPlay: context.ballsInPlay, sourceBall: srcBall });
    };

    p.spawnWallBullets = (position, count, damage, velBefore, wallNormal, spread) => {
        spawnWallBullets(p, position, count, damage, velBefore, wallNormal, { board: context.board, projectiles: context.projectiles }, spread);
    };
    
    p.addProjectiles = (projs) => context.projectiles.push(...projs);
    p.queueAction = (action) => context.delayedActionsQueue.push(action);
    p.recalculateActiveBallStats = () => {
        context.ballsInPlay.forEach(ball => { if (ball.recalculateStats) ball.recalculateStats(); });
        context.miniBalls.forEach(mb => { if (mb.recalculateStats) mb.recalculateStats(); });
    };
    
    p.damageBall = (amount, source) => {
        if (context.ballsInPlay.length > 0) {
            const ball = context.ballsInPlay[0];
            const eventPayload = ball.takeDamage(amount, source);
            if (eventPayload && p.processEvents) {
                p.processEvents([eventPayload]);
            }
        }
    };
    
    p.forceGameOver = () => {
        if (context.gameState === 'playing' || context.gameState === 'levelClearing' || context.gameState === 'aiming') {

            if (state.gameMode === 'invasionDefend') {
                dom.invasionShopUI.classList.add('hidden');
                dom.invasionNextWaveBtn.classList.add('hidden');
            }
            context.gameState = 'gameOver';
            if(p.handleGameStates) p.handleGameStates();
        }
    };
}
