
import { UNLOCK_LEVELS, GRID_CONSTANTS, XP_SETTINGS, AIMING_SETTINGS, BALL_STATS, BRICK_STATS, NPC_BALL_STATS, INVASION_MODE_PARAMS, ENCHANTER_STATS, INVASION_SHOP_ITEMS, CHARGE_SETTINGS } from './balancing.js';
import { Ball, MiniBall, createBallVisuals, calculateBallDamage, SniperProjectile } from './ball.js';
import { Brick } from './brick.js';
import { sounds } from './sfx.js';
import { Particle, Shockwave, FloatingText, PowerupVFX, StripeFlash, createSplat, createBrickHitVFX, createBallDeathVFX, XpOrb, LeechHealVFX, ZapperSparkle, FlyingIcon, ChainVFX, LootOrb, BreadCrumb } from './vfx.js';
import * as ui from './ui/index.js';
import { handleCombo } from './combo.js';
import { executeHealAction, executeBuildAction } from './brickOverlay.js';
import { checkCollisions } from './collision.js';
import { renderGame } from './render.js';
import * as event from './eventManager.js';
import * as equipmentManager from './equipmentManager.js';
import * as levelEditor from './levelEditor.js';
import { exportLevelToString } from './levelExporter.js';
import { importLevelFromString } from './levelImporter.js';
import { MILESTONE_LEVELS } from './firstTimeLevels.js';
import { BRICK_LEVELING_DATA, OVERLAY_LEVELING_DATA } from './brickLeveling.js';
import { processBrokenBricks, collectRunResource } from './brickLogic.js';
import { NPCBall } from './npcBall.js';
import { generateMysteryShopItems } from './ui/invasionShop.js';

// New Modules
import { setupController } from './gameController.js';
import { setupInput } from './inputHandlers.js';
import { addXp, handleChainDamage, determineEnchanterDrop, determineShellDrop, updateHomeBaseTimers, fireLasers, updateShieldAuras } from './gameUtils.js';
import { handleEndTurnEffects } from './endTurn.js';

export const sketch = (p, state, callbacks) => {
    // --- 1. Define Shared Context ---
    const context = {
        p,
        // Objects
        ballsInPlay: [],
        sharedBallStats: {},
        bricks: [[]],
        homeBaseBricks: [[]],
        selectedBrick: null,
        draggedBrick: null,
        draggedBrickOriginalPos: null,
        miniBalls: [],
        projectiles: [],
        ghostBalls: [],
        npcBalls: [],
        
        // Primitives
        ballsLeft: 5,
        level: 1,
        coins: 0,
        giantBallCount: 0,
        combo: 0,
        maxComboThisTurn: 0,
        runMaxCombo: 0,
        isGiantBallTurn: false,
        gameState: 'loading',
        equipmentBrickSpawnedThisLevel: false,
        currentSeed: null,
        levelHpPool: 0,
        levelCoinPool: 0,
        levelHpPoolSpent: 0,
        levelGemPool: 0,
        
        // XP & Stats
        xpOrbs: [],
        orbsCollectedThisTurn: 0,
        xpCollectPitchResetTimer: 0,
        levelStats: {},
        runStats: {},
        
        // VFX Arrays
        particles: [], shockwaves: [], floatingTexts: [], powerupVFXs: [], 
        stripeFlashes: [], leechHealVFXs: [], zapperSparkles: [], chainVFXs: [],
        lasers: [], vanishingLasers: [], lootOrbs: [], breadCrumbs: [],
        flyingIcons: [],
        
        // Timers & Utils
        shakeDuration: 0, shakeAmount: 0, splatBuffer: null,
        levelCompleteSoundPlayed: false, gameOverSoundPlayed: false,
        board: {},
        
        // Aiming
        isAiming: false,
        endAimPos: null,
        ghostBallCooldown: 0,
        
        // Queues
        delayedActionsQueue: [],
        endTurnActions: [],
        endTurnActionTimer: 0,
        zapperAuraTimer: 0,
        invasionSpawningQueue: [],
        npcSpawnTimer: 0,
        
        // Editor
        homeBaseHarvestedThisDrag: new Set(),
    };

    let ballVisuals = {};

    // --- 2. Initialize Sub-Modules ---
    setupController(p, context, state);
    setupInput(p, context, state);
    
    function updateVFX() {
        const arrays = [context.particles, context.shockwaves, context.floatingTexts, context.powerupVFXs, context.stripeFlashes, context.leechHealVFXs, context.zapperSparkles, context.chainVFXs];
        arrays.forEach(vfxArray => {
            for (let i = vfxArray.length - 1; i >= 0; i--) {
                const vfx = vfxArray[i];
                if (!vfx) { vfxArray.splice(i, 1); continue; }
                vfx.update();
                if (vfx.isFinished()) vfxArray.splice(i, 1);
            }
        });
        for (let i = context.vanishingLasers.length - 1; i >= 0; i--) {
            const laser = context.vanishingLasers[i];
            laser.vanishTimer--;
            if (laser.vanishTimer <= 0) context.vanishingLasers.splice(i, 1);
        }
    }

    p.processEvents = (initialEvents) => {
        let eventQueue = [...initialEvents];
        while (eventQueue.length > 0) {
            const evt = eventQueue.shift();
            if (!evt) continue;
            switch (evt.type) {
                case 'sound': if (evt.sound && sounds[evt.sound]) sounds[evt.sound](); break;
                case 'spawn_projectiles': if (evt.projectiles) context.projectiles.push(...evt.projectiles); break;
                case 'explode': if (evt.pos && evt.radius && evt.damage) p.explode(evt.pos, evt.radius, evt.damage, evt.source || 'unknown'); break;
                case 'damage_taken':
                    event.dispatch('BallHpLost', { amount: evt.damageAmount, source: evt.source, ball: context.ballsInPlay[0], position: evt.position });
                    
                    let currentBall = context.ballsInPlay[0];
                    let equipmentForDamage = [];
                    if (currentBall && typeof currentBall.getActiveEquipment === 'function') {
                         equipmentForDamage = currentBall.getActiveEquipment();
                    } else if (currentBall) {
                        const activeType = currentBall.type; 
                        equipmentForDamage = state.ballEquipment[activeType] ? state.ballEquipment[activeType].filter(Boolean) : [];
                    }

                    const impactDistributor = equipmentForDamage.find(item => item.id === 'impact_distributor');
                    if (impactDistributor) {
                        if (evt.source === 'wall' || evt.source === 'miniball_wall') evt.damageAmount = Math.max(0, evt.damageAmount + impactDistributor.value.wall);
                        else if (evt.source === 'brick') evt.damageAmount += impactDistributor.value.brick;
                    }

                    if (state.invulnerabilityTimer > 0) {
                        if (evt.source === 'wall' || evt.source === 'miniball_wall') sounds.wallHit();
                        break; 
                    }
    
                    if (evt.source === 'wall' || evt.source === 'miniball_wall') {
                        if (evt.source === 'wall') {
                            sounds.wallHit();
                            if (!context.isGiantBallTurn && context.combo > 0) { 
                                sounds.comboReset();
                                event.dispatch('ComboLost', { comboCountBeforeReset: context.combo });
                                context.combo = 0; state.comboParticles = [];
                            }
                        } else sounds.wallHit();
                    }
    
                    if (evt.source !== 'echo') {
                        context.sharedBallStats.hp = Math.max(0, context.sharedBallStats.hp - evt.damageAmount);
                        context.sharedBallStats.flashTime = 8;
                    }
    
                    if (context.sharedBallStats.hp <= 0 && context.ballsInPlay.length > 0) {
                        const mainBall = context.ballsInPlay[0];
                        const stats = BALL_STATS.types[mainBall.type];
                        const supportsDying = stats ? (stats.hasDyingState !== false) : true;

                        if (!mainBall.isDying) {
                            if (supportsDying) {
                                event.dispatch('BallDying', { ball: mainBall });
                                for (const ball of context.ballsInPlay) { ball.isDying = true; }
                                for (const mb of context.miniBalls) { mb.isDying = true; }
                            } else {
                                // Immediate death types (Piercing, Phaser, Grow, Giant)
                                // Must trigger handleDeath manually to ensure VFX/SFX/Item triggers happen
                                for (const ball of context.ballsInPlay) {
                                    ball.handleDeath(context.board, eventQueue);
                                }
                                for (const mb of context.miniBalls) {
                                    mb.handleDeath(context.board, eventQueue);
                                }
                                event.dispatch('BallDying', { ball: mainBall }); 
                            }
                            
                            context.isGiantBallTurn = false;
                            if (state.isSpedUp) {
                                state.isSpedUp = false;
                                document.getElementById('speedToggleBtn').textContent = 'Speed Up';
                                document.getElementById('speedToggleBtn').classList.remove('speed-active');
                            }
                        }
                    }
                    break;
                case 'brick_hit':
                    context.levelStats.totalDamage += evt.damageDealt;
                    context.levelStats.damageThisTurn += evt.damageDealt;
                    
                    const comboResult = handleCombo('brick_hit', evt.center, evt.source, {
                        p, isGiantBallTurn: context.isGiantBallTurn, ballsInPlay: context.ballsInPlay, 
                        combo: context.combo, maxComboThisTurn: context.maxComboThisTurn, runMaxCombo: context.runMaxCombo, 
                        getActiveEquipmentForBallType: (type) => {
                             if (context.ballsInPlay.length > 0) return context.ballsInPlay[0].getActiveEquipment();
                             return state.ballEquipment[type] ? state.ballEquipment[type].filter(Boolean) : [];
                        }
                    });
                    context.combo = comboResult.newCombo;
                    context.maxComboThisTurn = comboResult.newMaxComboThisTurn;
                    context.runMaxCombo = comboResult.newRunMaxCombo;

                    context.floatingTexts.push(new FloatingText(p, evt.center.x, evt.center.y, `${Math.floor(evt.damageDealt)}`, p.color(255, 255, 255), { size: 14, lifespan: 40, vel: p.createVector(0, -0.5) }));
                    
                    if(evt.coinsDropped > 0) {
                        let totalCoins = evt.coinsDropped;
                        if (state.isGoldenTurn) {
                            let mult = 2.0;
                            if (state.skillTreeState['golden_shot_coin_1']) mult += 0.5;
                            if (state.skillTreeState['golden_shot_coin_2']) mult += 0.5;
                            if (state.skillTreeState['golden_shot_coin_3']) mult += 0.5;
                            if (state.skillTreeState['golden_shot_coin_4']) mult += 0.5;
                            totalCoins = Math.floor(totalCoins * mult);
                        }
                        
                        p.addCoins(totalCoins);
                        event.dispatch('CoinCollected', { amount: totalCoins, ball: evt.source });
                        context.floatingTexts.push(new FloatingText(p, evt.center.x, evt.center.y, `+${totalCoins}`, p.color(255, 223, 0)));
                    }

                    if(evt.gemsDropped > 0) {
                        state.playerGems += evt.gemsDropped; state.lifetimeGems += evt.gemsDropped;
                        context.levelStats.gemsCollected += evt.gemsDropped;
                        sounds.gemCollect();
                        context.floatingTexts.push(new FloatingText(p, evt.center.x, evt.center.y, `+${evt.gemsDropped}`, p.color(0, 229, 255)));
                        const r = p.canvas.getBoundingClientRect(); ui.animateGemParticles(r.left + evt.center.x, r.top + evt.center.y, evt.gemsDropped);
                    }
                    
                    if (evt.foodDropped > 0) {
                        collectRunResource(p, 'food', evt.foodDropped, evt.center, { state, gameController: p, runStats: context.runStats, levelStats: context.levelStats, floatingTexts: context.floatingTexts });
                    }

                    if (evt.woodDropped > 0) {
                        collectRunResource(p, 'wood', evt.woodDropped, evt.center, { state, gameController: p, runStats: context.runStats, levelStats: context.levelStats, floatingTexts: context.floatingTexts });
                    }
                    
                    context.particles.push(...createBrickHitVFX(p, evt.center.x, evt.center.y, evt.color));
                    sounds.brickHit(p, evt.totalLayers);
                    context.shakeAmount = Math.max(context.shakeAmount, 2); context.shakeDuration = Math.max(context.shakeDuration, 5);

                    if(evt.isBroken) {
                        sounds.brickBreak();
                        context.particles.push(...createBrickHitVFX(p, evt.center.x, evt.center.y, evt.color));
                        if (state.gameMode === 'invasionDefend') {
                            let goalsLeft = 0;
                            for (let c=0; c<context.board.cols; c++) for (let r=0; r<context.board.rows; r++) if (context.bricks[c][r]?.type === 'goal') goalsLeft++;
                            if (goalsLeft === 0) context.gameState = 'gameOver';
                        }
                        
                        if (evt.source && evt.source.type === 'seeker') {
                            p.spawnHomingProjectile(evt.center.copy(), null, evt.source);
                        }
                    }
                    if (evt.events && evt.events.length > 0) eventQueue.push(...evt.events);

                    const chainEvents = handleChainDamage(evt.source, evt.brick, context);
                    if (chainEvents.length > 0) eventQueue.push(...chainEvents);
                    break;
                 case 'explode_mine': p.explode(evt.pos, context.board.gridUnitSize * BRICK_STATS.mine.radiusTiles, BRICK_STATS.mine.damage, 'mine'); break;
                 case 'dying_ball_death': context.particles.push(...createBallDeathVFX(p, evt.pos.x, evt.pos.y)); sounds.ballDeath(); break;
                 case 'spawn_miniballs': if (evt.miniballs) { context.miniBalls.push(...evt.miniballs); sounds.split(); } break;
                case 'spawn_breadcrumb': context.breadCrumbs.push(new BreadCrumb(p, evt.pos.x, evt.pos.y)); break;
            }
        }
        
        const ctx = { p, board: context.board, bricks: context.bricks, splatBuffer: context.splatBuffer, ballsInPlay: context.ballsInPlay, sharedBallStats: context.sharedBallStats, levelStats: context.levelStats, floatingTexts: context.floatingTexts, shockwaves: context.shockwaves, particles: context.particles, sounds, gameStateRef: {value: context.gameState}, ballsLeftRef: {value: context.ballsLeft}, BRICK_STATS, gameController: p, runStats: context.runStats, miniBalls: context.miniBalls };
        processBrokenBricks(initialEvents.find(e => e.type === 'brick_hit'), ctx);
        context.gameState = ctx.gameStateRef.value;
        context.ballsLeft = ctx.ballsLeftRef.value;
    };
    
    p.setup = () => {
        const container = document.getElementById('canvas-container');
        const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
        canvas.elt.style.width = '100%'; canvas.elt.style.height = '100%';
        
        context.splatBuffer = p.createGraphics(container.clientWidth, container.clientHeight);
        sounds.init(new (window.AudioContext || window.webkitAudioContext)());
        p.windowResized(); 
        ballVisuals = createBallVisuals(p);
        if (callbacks && callbacks.onVisualsReady) callbacks.onVisualsReady(ballVisuals);
        
        Object.keys(ballVisuals).forEach(type => {
            const btnVisual = document.querySelector(`.ball-select-btn[data-ball-type="${type}"] .ball-visual`);
            if (btnVisual) btnVisual.style.backgroundImage = `url(${ballVisuals[type]})`;
        });
        
        event.registerDebugListener((eventName, payload) => {
            if (!state.isDebugView) return;
            let pos = payload?.ball?.pos || payload?.miniBall?.pos || (payload?.brick?.getPixelPos ? payload.brick.getPixelPos(context.board).add(context.board.gridUnitSize/2,context.board.gridUnitSize/2) : payload?.pos);
            if (pos) {
                if (state.showEventLogDebug) context.floatingTexts.push(new FloatingText(p, pos.x, pos.y, `EVENT: ${eventName}`, p.color(255, 100, 255), { size: 10, lifespan: 120, vel: p.createVector(0, -1) }));
                if (state.showEquipmentDebug) {
                    const eqText = equipmentManager.getDebugReturnsForEvent(eventName, payload)?.join('\n');
                    if (eqText) context.floatingTexts.push(new FloatingText(p, pos.x, pos.y + (state.showEventLogDebug?12:0), eqText, p.color(100, 255, 100), { size: 10, lifespan: 120, vel: p.createVector(0, -1) }));
                }
            }
        });

        context.homeBaseBricks = Array(context.board.cols).fill(null).map(() => Array(context.board.rows).fill(null));
        if (state.mainLevel < UNLOCK_LEVELS.HOME_BASE) p.resetGame(ui.getLevelSettings(), 1);
        else p.enterHomeBase();
    };

    p.draw = () => {
        if (context.gameState === 'loading') {
            p.background(40, 45, 55); p.fill(255); p.textAlign(p.CENTER, p.CENTER); p.textSize(24); p.text("Loading...", p.width/2, p.height/2);
            return;
        }

        if (state.isEditorMode) {
            updateShieldAuras(context); 
            levelEditor.draw(p, { ...context });
            return;
        }
        
        let homeBaseTimeMultiplier = 1;
        if (state.homeBaseTimeMultiplier > 1 && Date.now() < state.homeBaseTimeMultiplierEnd) {
            homeBaseTimeMultiplier = state.homeBaseTimeMultiplier;
            const speedBtn = dom.cheatSpeedUpBtn;
            if (speedBtn && !speedBtn.classList.contains('hidden')) speedBtn.textContent = `x${homeBaseTimeMultiplier} Speed (${((state.homeBaseTimeMultiplierEnd - Date.now()) / 1000).toFixed(1)}s)`;
        } else if (state.homeBaseTimeMultiplier > 1) {
            state.homeBaseTimeMultiplier = 1; state.homeBaseTimeMultiplierEnd = 0;
            if(dom.cheatSpeedUpBtn) { dom.cheatSpeedUpBtn.textContent = 'x20 Speed (3s)'; dom.cheatSpeedUpBtn.disabled = false; }
        }

        if (state.mainLevel >= UNLOCK_LEVELS.HOME_BASE && context.homeBaseBricks.length > 0) {
            updateHomeBaseTimers(homeBaseTimeMultiplier, context, state);
        }
        
        if (state.gameMode === 'adventureRun' || state.gameMode === 'trialRun' || state.gameMode === 'invasionDefend') {
            const timeMultiplier = state.isSpedUp ? 2 : 1;
            for (let i = 0; i < timeMultiplier; i++) gameLoop(i === timeMultiplier - 1);
        } else {
            updateVFX();
            updateShieldAuras(context);
            const brickTimers = {};
             for (let c = 0; c < context.board.cols; c++) {
                for (let r = 0; r < context.board.rows; r++) {
                    const brick = context.homeBaseBricks[c][r];
                    if (brick) {
                        const key = brick.c + ',' + brick.r;
                        if(brick.type === 'BallProducer' && brick.production.queueCount > 0) {
                            brickTimers[key] = { timer: brick.production.progress, maxTimer: brick.production.maxTimer, canProduce: !brick.heldBall };
                        } else if (brick.type === 'Farmland' || brick.type === 'Sawmill') {
                            brickTimers[key] = { timer: Math.min(brick.internalResourcePool, 10), maxTimer: 10, canProduce: brick.internalResourcePool < 10 };
                        }
                    }
                }
            }

            renderGame(p, { ...context, gameState: 'homeBase' }, { producer: brickTimers });
            ui.updateHeaderUI(0, state.mainLevel, 0, 0, 'HOME', 0, state.playerGems, state.playerFood, state.playerWood, 'homeBase', null, context.runStats, state.playerEquipment.length, [], [], null, 0, 0, 0, state.playerEnchanters);
        }
    };
    
    function gameLoop(shouldRender) {
        updateShieldAuras(context); 

        if (state.gameMode !== 'invasionDefend') {
            if ((context.gameState === 'playing' || context.gameState === 'levelClearing') && context.ballsInPlay.length === 0 && context.miniBalls.length === 0 && context.projectiles.length === 0 && context.delayedActionsQueue.length === 0) {
                event.dispatch('TurnEnd', {}); 
                const oldGameState = context.gameState;
                const result = handleEndTurnEffects({ p, board: context.board, bricks: context.bricks, level: context.level, maxComboThisTurn: context.maxComboThisTurn, floatingTexts: context.floatingTexts, levelStats: context.levelStats, gameState: context.gameState, ballsLeft: context.ballsLeft, giantBallCount: context.giantBallCount });
                context.gameState = result.gameState;
                context.giantBallCount = result.giantBallCount;
                context.combo = result.combo;
                context.maxComboThisTurn = result.maxComboThisTurn;
                context.orbsCollectedThisTurn = result.orbsCollectedThisTurn;
                context.xpCollectPitchResetTimer = result.xpCollectPitchResetTimer;
                context.endTurnActions = result.endTurnActions;
                context.endTurnActionTimer = result.endTurnActionTimer;
                context.isGiantBallTurn = result.isGiantBallTurn;
                context.ballsLeft = result.ballsLeft;
    
                if (context.gameState === 'aiming' && oldGameState !== 'aiming') fireLasers(context);
            }
        }
        
        if (context.gameState === 'endTurnSequence') {
            context.endTurnActionTimer--;
            if (context.endTurnActionTimer <= 0) {
                const action = context.endTurnActions.shift();
                if (action) {
                    const vfx = { shockwaves: context.shockwaves, particles: context.particles };
                    if (action.type === 'heal') executeHealAction(p, context.board, context.bricks, action.brick, vfx, sounds);
                    else if (action.type === 'build') executeBuildAction(p, context.board, context.bricks, action.brick, vfx, sounds);
                    context.endTurnActionTimer = 2; 
                }
                if (context.endTurnActions.length === 0) {
                    const oldGameState = context.gameState;
                    let goalBricksLeft = 0;
                    for (let c = 0; c < context.board.cols; c++) for (let r = 0; r < context.board.rows; r++) if (context.bricks[c][r]?.type === 'goal') goalBricksLeft++;
        
                    if (goalBricksLeft === 0) {
                        context.gameState = 'levelComplete';
                        if (MILESTONE_LEVELS[context.level] && !state.milestonesCompleted[level]) state.milestonesCompleted[context.level] = true;
                    } else context.gameState = 'aiming';
                    
                    if (context.gameState === 'aiming' && oldGameState !== 'aiming') fireLasers(context);
                    state.isGoldenTurn = state.skillTreeState['unlock_golden_shot'] ? p.random() < 0.1 : false;
                }
            }
        }
        
        for (let i = context.delayedActionsQueue.length - 1; i >= 0; i--) {
            const action = context.delayedActionsQueue[i];
            action.delay--;
            if (action.delay <= 0) {
                if (action.type === 'damage' && action.brick) {
                    const hitResult = action.brick.hit(action.damage, action.source, context.board);
                    if (hitResult) p.processEvents([{ type: 'brick_hit', ...hitResult, source: action.source, brick: action.brick }]);
                } else if (action.type === 'spawn_clone' && action.ball) {
                    const startVel = action.ball.vel.copy();
                    if (action.isFullClone) {
                        const newBall = new Ball(p, action.ball.pos.x, action.ball.pos.y, action.ball.type, context.board.gridUnitSize, state.upgradeableStats);
                        newBall.vel = startVel; newBall.isMoving = true;
                        newBall.powerUpUses = context.sharedBallStats.uses; newBall.powerUpMaxUses = context.sharedBallStats.maxUses;
                        newBall.hp = context.sharedBallStats.hp; newBall.maxHp = context.sharedBallStats.maxHp;
                        context.ballsInPlay.push(newBall); sounds.split();
                    } else {
                        const parentBallInstanceId = (action.ball instanceof Ball) ? action.ball.instanceId : null;
                        context.miniBalls.push(new MiniBall(p, action.ball.pos.x, action.ball.pos.y, startVel, context.board.gridUnitSize, action.ball.type, parentBallInstanceId));
                        if (action.ball.type !== 'miniball') sounds.split(); 
                    }
                }
                context.delayedActionsQueue.splice(i, 1);
            }
        }

        let debugStats = null;
        if (state.isDebugView) {
            let currentHp = 0, currentCoins = 0;
            for(let c=0; c<context.board.cols; c++) for(let r=0; r<context.board.rows; r++) if(context.bricks[c][r]) { currentHp += context.bricks[c][r].health; currentCoins += context.bricks[c][r].coins; }
            debugStats = { currentHp, hpPool: context.levelHpPool, currentCoins, coinPool: context.levelCoinPool, hpPoolSpent: context.levelHpPoolSpent };
        }
        ui.updateHeaderUI(context.level, state.mainLevel, context.ballsLeft, context.giantBallCount, context.currentSeed, context.coins, state.playerGems, state.playerFood, state.playerWood, context.gameState, debugStats, context.runStats, state.playerEquipment.length, context.ballsInPlay, context.miniBalls, (ball, combo) => calculateBallDamage(ball, combo, state), context.combo, context.npcBalls.length, state.invasionWave, state.playerEnchanters);
        
        if (context.xpCollectPitchResetTimer > 0) context.xpCollectPitchResetTimer--; else if (context.orbsCollectedThisTurn > 0) context.orbsCollectedThisTurn = 0;
        if (context.ghostBallCooldown > 0) context.ghostBallCooldown--;
        if (state.invulnerabilityTimer > 0) state.invulnerabilityTimer--;
        if (state.capacitorChargeEffect > 0) state.capacitorChargeEffect--;
        if (context.sharedBallStats.flashTime > 0) context.sharedBallStats.flashTime--;
        if (context.shakeDuration > 0) { context.shakeDuration--; if (context.shakeDuration <= 0) context.shakeAmount = 0; }

        if (context.gameState === 'aiming' && context.isAiming && context.ballsInPlay.length > 0 && context.endAimPos) {
             if (context.ghostBallCooldown <= 0) {
                context.ghostBallCooldown = AIMING_SETTINGS.GHOST_BALL_COOLDOWN;
                const ball = context.ballsInPlay[0];
                const aimDir = p.constructor.Vector.sub(context.endAimPos, ball.pos);
                if (aimDir.magSq() > 1) {
                    const ghost = new Ball(p, ball.pos.x, ball.pos.y, ball.type, context.board.gridUnitSize, state.upgradeableStats, { isGhost: true, lifetimeInSeconds: state.upgradeableStats.aimLength });
                    const baseSpeed = (context.board.gridUnitSize * 0.5) * state.originalBallSpeed * AIMING_SETTINGS.GHOST_BALL_SPEED_MULTIPLIER;
                    ghost.vel = aimDir.normalize().mult(baseSpeed); ghost.isMoving = true;
                    context.ghostBalls.push(ghost);
                }
            }
        }

        if (context.gameState === 'aiming' && context.ballsInPlay.length === 0 && state.gameMode !== 'invasionDefend') {
             let canUseAnyBall = false;
            if (state.gameMode === 'trialRun') {
                const totalBalls = Object.values(state.trialRunBallStock).reduce((a,b)=>a+b,0);
                canUseAnyBall = totalBalls > 0;
                if (canUseAnyBall && state.trialRunBallStock[state.selectedBallType] <= 0) {
                    const nextType = Object.keys(state.trialRunBallStock).find(t => state.trialRunBallStock[t] > 0);
                    if(nextType) { state.selectedBallType = nextType; ui.updateBallSelectorUI(state.mainLevel, context.ballsLeft, context.giantBallCount, context.gameState); }
                }
            } else { 
                let canUseRegular = context.ballsLeft > 0;
                const canUseGiant = context.giantBallCount > 0 && state.mainLevel >= UNLOCK_LEVELS.GIANT_BONUS;
                
                if (!canUseRegular && canUseGiant && state.selectedBallType !== 'giant') {
                    state.selectedBallType = 'giant'; ui.updateBallSelectorUI(state.mainLevel, context.ballsLeft, context.giantBallCount, context.gameState);
                }
                if (!canUseRegular && !canUseGiant) {
                    let cost = state.shopParams.buyBall.baseCost + state.ballPurchaseCount * state.shopParams.buyBall.increment;
                    if (state.ballPurchaseCount === 0 && state.skillTreeState['discount_first_ball']) cost -= 10;
                    state.currentBallCost = Math.max(0, cost);
                    if (state.mainLevel >= UNLOCK_LEVELS.SHOP_BUY_BALL && context.coins >= state.currentBallCost) {
                        context.coins -= state.currentBallCost;
                        context.ballsLeft++; state.ballPurchaseCount++;
                        canUseRegular = true; sounds.ballGained();
                        p.addFloatingText("Auto-bought a ball!", p.color(255, 223, 0), { size: 20, isBold: true, lifespan: 120 });
                    } else context.gameState = 'gameOver';
                }
                canUseAnyBall = canUseRegular || (context.giantBallCount > 0 && state.mainLevel >= UNLOCK_LEVELS.GIANT_BONUS);
            }
            
            if (context.gameState !== 'gameOver' && canUseAnyBall) {
                let ballType = state.selectedBallType;
                if (state.gameMode === 'adventureRun' && state.selectedBallType === 'giant' && !(context.giantBallCount > 0 && state.mainLevel >= UNLOCK_LEVELS.GIANT_BONUS)) {
                    ballType = 'classic'; ui.updateBallSelectorUI(state.mainLevel, context.ballsLeft, context.giantBallCount, context.gameState);
                }

                const newBall = new Ball(p, context.board.x + context.board.width / 2, context.board.y + context.board.height - context.board.border, ballType, context.board.gridUnitSize, state.upgradeableStats);
                context.ballsInPlay.push(newBall);
                context.sharedBallStats = { hp: newBall.hp, maxHp: newBall.maxHp, uses: newBall.powerUpUses, maxUses: newBall.powerUpMaxUses, flashTime: 0 };
                p.setBallSpeedMultiplier(state.originalBallSpeed);
            }
        }
        
        const rampingBall = context.ballsInPlay.length > 0 ? context.ballsInPlay[0] : null;
        const rampingDamageItem = rampingBall ? rampingBall.getActiveEquipment().find(item => item.id === 'ramping_damage') : null;
        if (rampingDamageItem && (context.gameState === 'playing' || context.gameState === 'levelClearing') && context.ballsInPlay.length > 0) {
            state.rampingDamageTimer++;
            if (state.rampingDamageTimer >= rampingDamageItem.config.tickRate) { 
                state.rampingDamage += rampingDamageItem.value.main;
                state.rampingDamageTimer = 0;
                context.ballsInPlay.forEach(ball => {
                    state.overchargeParticles.push({ offset: p.constructor.Vector.random2D().mult(p.random(ball.radius, ball.radius * 1.5)) });
                });
            }
        }

        let zapperBrick = null, zapBatteries = [];
        for(let c=0; c<context.board.cols; c++) for(let r=0; r<context.board.rows; r++) {
             if(context.bricks[c][r]) { if(context.bricks[c][r].overlay === 'zapper') zapperBrick = context.bricks[c][r]; if(context.bricks[c][r].overlay === 'zap_battery') zapBatteries.push(context.bricks[c][r]); }
        }

        if (zapperBrick && zapBatteries.length > 0 && (context.gameState === 'playing' || context.gameState === 'levelClearing')) {
            context.zapperAuraTimer++;
            const zapperPos = zapperBrick.getPixelPos(context.board).add(zapperBrick.size / 2, zapperBrick.size / 2);
            const auraRadius = context.board.gridUnitSize * (1.5 + (zapBatteries.length - 1) * 0.5);
            if (p.frameCount % 2 === 0) for(let i=0; i<2; i++) context.zapperSparkles.push(new ZapperSparkle(p, zapperPos.x, zapperPos.y, auraRadius));
            if (context.zapperAuraTimer >= BRICK_STATS.zapper.intervalFrames) {
                context.zapperAuraTimer = 0; let ballWasZapped = false;
                [...context.ballsInPlay, ...context.miniBalls].forEach(ball => {
                    if (p.dist(ball.pos.x, ball.pos.y, zapperPos.x, zapperPos.y) < auraRadius + ball.radius) {
                        p.processEvents([{ type: 'damage_taken', source: 'zapper', ballType: ball.type === 'miniball' ? ball.parentType : ball.type, damageAmount: BRICK_STATS.zapper.damage, position: ball.pos.copy() }]);
                        ballWasZapped = true;
                    }
                });
                if (ballWasZapped) { sounds.zap(); for(let i=0; i<10; i++) context.particles.push(new Particle(p, zapperPos.x, zapperPos.y, p.color(221, 160, 221), 1, { vel: p.constructor.Vector.random2D().mult(p.random(2, 4)), size: p.random(2, 4), lifespan: 30 })); }
            }
        }

        if ((context.gameState === 'playing' || context.gameState === 'levelClearing')) {
            state.zapAuraTimer++;
            const allBalls = [...context.ballsInPlay, ...context.miniBalls];
            let hitEvents = [];
            for (const ball of allBalls) {
                let equipment = [];
                if (typeof ball.getActiveEquipment === 'function') {
                    equipment = ball.getActiveEquipment();
                } else if (ball instanceof MiniBall) {
                     const type = ball.parentType;
                     equipment = state.ballEquipment[type] ? state.ballEquipment[type].filter(Boolean) : [];
                } else {
                     const type = ball.type;
                     equipment = state.ballEquipment[type] ? state.ballEquipment[type].filter(Boolean) : [];
                }
                const zapAura = equipment.find(item => item.id === 'zap_aura');
                if (zapAura) {
                    if (state.zapAuraTimer >= zapAura.config.tickRate) {
                        const isMini = ball instanceof MiniBall;
                        if (!isMini || zapAura.value.miniRadius) {
                            const radiusTiles = isMini ? zapAura.value.miniRadius : zapAura.config.auraRadiusTiles;
                            const auraRadius = context.board.gridUnitSize * radiusTiles;
                            const auraDamage = zapAura.value.main;
                            const minC = Math.max(0, Math.floor((ball.pos.x - auraRadius - context.board.genX) / context.board.gridUnitSize));
                            const maxC = Math.min(context.board.cols - 1, Math.floor((ball.pos.x + auraRadius - context.board.genX) / context.board.gridUnitSize));
                            const minR = Math.max(0, Math.floor((ball.pos.y - auraRadius - context.board.genY) / context.board.gridUnitSize));
                            const maxR = Math.min(context.board.rows - 1, Math.floor((ball.pos.y + auraRadius - context.board.genY) / context.board.gridUnitSize));
                            const hitBricks = new Set();
                            for (let c = minC; c <= maxC; c++) {
                                for (let r = minR; r <= maxR; r++) {
                                    const brick = context.bricks[c][r];
                                    if (brick && !hitBricks.has(brick)) {
                                        const bPos = brick.getPixelPos(context.board);
                                        const w = brick.size * brick.widthInCells; const h = brick.size * brick.heightInCells;
                                        let testX = ball.pos.x, testY = ball.pos.y;
                                        if (ball.pos.x < bPos.x) testX = bPos.x; else if (ball.pos.x > bPos.x + w) testX = bPos.x + w;
                                        if (ball.pos.y < bPos.y) testY = bPos.y; else if (ball.pos.y > bPos.y + h) testY = bPos.y + h;
                                        const distSq = (ball.pos.x - testX)**2 + (ball.pos.y - testY)**2;
                                        if (distSq <= auraRadius**2) {
                                            hitBricks.add(brick);
                                            const hitResult = brick.hit(auraDamage, 'zap_aura', context.board);
                                            if (hitResult) hitEvents.push({ type: 'brick_hit', ...hitResult, source: 'zap_aura', brick });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (hitEvents.length > 0) p.processEvents(hitEvents);
            if (state.zapAuraTimer >= 15) state.zapAuraTimer = 0;
        }

        if ((context.gameState === 'playing' || context.gameState === 'levelClearing') || (state.gameMode === 'invasionDefend' && context.gameState === 'aiming')) {
             for(let c=0; c<context.board.cols; c++) for(let r=0; r<context.board.rows; r++) {
                 const brick = context.bricks[c][r];
                 if (brick && brick.overlay === 'sniper') {
                     if (context.gameState === 'playing') if(brick.sniperCharge < BRICK_STATS.sniper.cooldownFrames) brick.sniperCharge += (state.gameMode === 'invasionDefend' ? 2 : 1);
                     if (brick.sniperCharge >= BRICK_STATS.sniper.cooldownFrames) {
                         let target = (state.gameMode === 'invasionDefend') ? context.npcBalls[0] : context.ballsInPlay[0];
                         if (target) {
                             const bPos = brick.getPixelPos(context.board).add(brick.size/2, brick.size/2);
                             if (p.dist(bPos.x, bPos.y, target.pos.x, target.pos.y) <= BRICK_STATS.sniper.rangeTiles * context.board.gridUnitSize) {
                                 brick.sniperCharge = 0;
                                 context.projectiles.push(new SniperProjectile(p, bPos, p.constructor.Vector.sub(target.pos, bPos).normalize().mult(context.board.gridUnitSize*1.5), BRICK_STATS.sniper.damage, { piercesBricks: true }));
                                 sounds.sniperFire();
                             }
                         }
                     }
                 }
             }
        }
        
        if (context.lasers.length > 0 && (context.gameState === 'playing' || context.gameState === 'levelClearing' || (state.gameMode === 'invasionDefend' && context.gameState === 'playing'))) {
            const targets = [...context.ballsInPlay, ...context.npcBalls];
            if (targets.length > 0) {
                for (let i = context.lasers.length - 1; i >= 0; i--) {
                    const laser = context.lasers[i];
                    let hit = false;
                    for (const ball of targets) {
                        if (ball instanceof Ball && !ball.isMoving) continue;
                        const d = p.constructor.Vector.sub(laser.end, laser.start);
                        const f = p.constructor.Vector.sub(laser.start, ball.pos);
                        const a = d.dot(d);
                        const b = 2 * f.dot(d);
                        const c = f.dot(f) - ball.radius * ball.radius;
                        let discriminant = b * b - 4 * a * c;
                        if (discriminant >= 0) {
                            discriminant = Math.sqrt(discriminant);
                            const t1 = (-b - discriminant) / (2 * a);
                            const t2 = (-b + discriminant) / (2 * a);
                            if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)) {
                                let damage = BRICK_STATS.laser.damage;
                                if(laser.brick && laser.brick.overlayId) {
                                    const overlay = state.overlayInventory.find(o => o.id === laser.brick.overlayId);
                                    if(overlay) { const data = OVERLAY_LEVELING_DATA.laser[overlay.level-1]; if(data?.stats?.damage) damage = data.stats.damage; }
                                }
                                if (ball instanceof NPCBall) p.processEvents(ball.takeDamage(damage));
                                else { const evt = ball.takeDamage(damage, 'laser'); if(evt) p.processEvents([evt]); }
                                for(let j=0; j<20; j++) context.particles.push(new Particle(p, ball.pos.x, ball.pos.y, p.color(255,80,200), 4, {lifespan: 40}));
                                sounds.zap();
                                context.lasers.splice(i, 1);
                                hit = true;
                                break;
                            }
                        }
                    }
                    if (hit) continue;
                }
            }
        }
        
        if ((context.gameState === 'playing' || context.gameState === 'levelClearing') && context.ballsInPlay.length > 0) {
            for (let i = context.ballsInPlay.length - 1; i >= 0; i--) {
                const ball = context.ballsInPlay[i];
                if (!ball.isGhost && ball.type !== 'giant') { ball.hp = context.sharedBallStats.hp; ball.maxHp = context.sharedBallStats.maxHp; }
                const events = ball.update(context.board, (b) => checkCollisions(p, b, context.board, context.bricks, context.combo, state));
                if (events.length > 0) p.processEvents(events);
                if (ball.isDead) context.ballsInPlay.splice(i, 1);
            }
        }
        
        if (state.gameMode === 'invasionDefend' && (context.gameState === 'playing' || context.gameState === 'levelClearing')) {
            if (context.invasionSpawningQueue.length > 0) {
                context.npcSpawnTimer--;
                if (context.npcSpawnTimer <= 0) {
                    const npcData = context.invasionSpawningQueue.shift();
                    context.npcBalls.push(new NPCBall(p, npcData.pos, npcData.vel, npcData.type, context.board.gridUnitSize, npcData.target, npcData.guaranteedEnchanterDrop));
                    context.npcSpawnTimer = 10;
                }
            }
            for (let i = context.npcBalls.length - 1; i >= 0; i--) {
                const npc = context.npcBalls[i];
                npc.update(context.board, context.bricks, (events) => p.processEvents(events));
                if (npc.isDead) {
                    p.spawnXpOrbs(Math.floor(npc.maxHp / 10), npc.pos);
                    const enchanterDrop = determineEnchanterDrop(npc, state, p);
                    if (enchanterDrop) {
                        context.lootOrbs.push(new LootOrb(p, npc.pos.x, npc.pos.y, enchanterDrop.type, enchanterDrop.amount));
                    }
                    const shellDrop = determineShellDrop(npc, state, p);
                    if (shellDrop) {
                        for (let k = 0; k < shellDrop.amount; k++) {
                            context.lootOrbs.push(new LootOrb(p, npc.pos.x, npc.pos.y, shellDrop.type, 1));
                        }
                    }
                    createSplat(p, context.splatBuffer, npc.pos.x, npc.pos.y, npc.color, context.board.gridUnitSize);
                    context.npcBalls.splice(i, 1); sounds.brickBreak();
                }
                }
            if (context.invasionSpawningQueue.length === 0 && context.npcBalls.length === 0 && context.gameState === 'playing') {
                context.gameState = 'aiming';
                context.runStats.mysteryShopItems = generateMysteryShopItems(context.runStats.invasionRunCoins || 0);
                dom.invasionNextWaveBtn.classList.remove('hidden');
                dom.invasionShopUI.classList.remove('hidden'); ui.renderInvasionShopUI();
            }
        }
        
        for (let i = context.ghostBalls.length - 1; i >= 0; i--) {
            const gb = context.ghostBalls[i];
            gb.update(context.board, (b) => checkCollisions(p, b, context.board, context.bricks, context.combo, state));
            if (gb.isDead) context.ghostBalls.splice(i, 1);
        }

        for (let i = context.miniBalls.length - 1; i >= 0; i--) {
            const mb = context.miniBalls[i];
            mb.hp = context.sharedBallStats.hp;
            mb.maxHp = context.sharedBallStats.maxHp;
            const events = mb.update(context.board, (b) => checkCollisions(p, b, context.board, context.bricks, context.combo, state));
            if (events && events.length > 0) p.processEvents(events);
            if (mb.isDead) context.miniBalls.splice(i, 1);
        }

        for (let i = context.projectiles.length - 1; i >= 0; i--) {
            const proj = context.projectiles[i];
            const result = proj.update(context.board, context.bricks);
            if (proj.piercesBricks && proj instanceof SniperProjectile) {
                const targets = state.gameMode === 'invasionDefend' ? context.npcBalls : [...context.ballsInPlay, ...context.miniBalls];
                for (const target of targets) {
                    if (p.dist(proj.pos.x, proj.pos.y, target.pos.x, target.pos.y) < target.radius + proj.radius) {
                        if (target instanceof NPCBall) p.processEvents(target.takeDamage(proj.damage));
                        else { const evt = target.takeDamage(proj.damage, 'sniper'); if(evt) p.processEvents([evt]); }
                        proj.isDead = true;
                        sounds.zap();
                        for(let k=0;k<20;k++) context.particles.push(new Particle(p, proj.pos.x, proj.pos.y, p.color(255,0,0), 4, {lifespan:40}));
                        if (state.gameMode === 'trialRun') {
                            context.runStats.totalWireCollected = (context.runStats.totalWireCollected || 0) + 1;
                            context.floatingTexts.push(new FloatingText(p, proj.pos.x, proj.pos.y, '+1 🪢', p.color(255,140,0), {isBold:true}));
                        }
                        break;
                    }
                }
            }
            if (result) {
                if (result.type === 'homing_explode') p.explode(result.pos, result.radius, result.damage, 'homing_explode');
                else p.processEvents([result]);
            }
            if (proj.isDead) context.projectiles.splice(i, 1);
        }

        for (let i = context.breadCrumbs.length - 1; i >= 0; i--) {
            const bc = context.breadCrumbs[i];
            bc.update();
            if (bc.isFinished()) {
                context.breadCrumbs.splice(i, 1);
            } else if (bc.invulnerableTimer <= 0) {
                let collected = false;
                const attractors = [...context.ballsInPlay, ...context.miniBalls];
                for (const ball of attractors) {
                    if (p.dist(bc.pos.x, bc.pos.y, ball.pos.x, ball.pos.y) < bc.radius + ball.radius) {
                        const activeBallType = (context.ballsInPlay.length > 0) ? context.ballsInPlay[0].type : state.selectedBallType;
                        const equipment = state.ballEquipment[activeBallType]?.filter(Boolean) || []; 
                        const bcItem = equipment.find(e => e.id === 'bread_crumbs');
                        const healAmount = bcItem ? bcItem.config.healAmount : 10;
                        p.healBall(healAmount);
                        sounds.ballHeal();
                        context.floatingTexts.push(new FloatingText(p, bc.pos.x, bc.pos.y, `+${healAmount} HP`, p.color(0, 255, 127), {isBold: true}));
                        collected = true;
                        break;
                    }
                }
                if (collected) context.breadCrumbs.splice(i, 1);
            }
        }
        
        for (let i = context.flyingIcons.length - 1; i >= 0; i--) {
            const fi = context.flyingIcons[i];
            fi.update();
            if (fi.isFinished()) context.flyingIcons.splice(i, 1);
        }
        
        let magnetMultiplier = 1.0;
        let ownedMagnetRadiusUpgrades = 0;
        if (state.skillTreeState['magnet_radius_1']) ownedMagnetRadiusUpgrades++;
        if (state.skillTreeState['magnet_radius_2']) ownedMagnetRadiusUpgrades++;
        if (state.skillTreeState['magnet_radius_3']) ownedMagnetRadiusUpgrades++;
        if (state.skillTreeState['magnet_radius_4']) ownedMagnetRadiusUpgrades++;
        if (state.skillTreeState['magnet_radius_5']) ownedMagnetRadiusUpgrades++;
        
        let effectiveRadiusMultiplier = XP_SETTINGS.baseMagneticRadiusMultiplier + (ownedMagnetRadiusUpgrades * 0.5);
        let equipmentMagneticMultiplier = 1;
        
        const activeBallTypeForMagnet = context.ballsInPlay.length > 0 ? context.ballsInPlay[0].type : state.selectedBallType;
        const magnetEquipmentList = state.ballEquipment[activeBallTypeForMagnet]?.filter(Boolean) || [];
        const magnet = magnetEquipmentList.find(e => e.id === 'xp_magnet');
        if (magnet) {
            magnetMultiplier = magnet.value.xp; 
            equipmentMagneticMultiplier = magnet.value.radius;
        }

        let orbAttractors = (state.gameMode === 'invasionDefend' && p.mouseIsPressed) ? [{pos: p.createVector(p.mouseX, p.mouseY), radius: context.board.gridUnitSize*0.3}] : (context.gameState !== 'aiming' ? [...context.ballsInPlay, ...context.miniBalls] : []);
        for (let i = context.lootOrbs.length - 1; i >= 0; i--) {
            const orb = context.lootOrbs[i];
            orb.update(orbAttractors, 1);
            if (orb.isFinished()) { context.lootOrbs.splice(i, 1); continue; }
            for (const attractor of orbAttractors) {
                if (orb.state !== 'collecting' && p.dist(orb.pos.x, orb.pos.y, attractor.pos.x, attractor.pos.y) < attractor.radius + orb.radius) {
                    orb.collect();
                    if(p.addLoot) p.addLoot(orb.type, orb.amount);
                    break;
                }
            }
        }
        
        for (let i = context.xpOrbs.length - 1; i >= 0; i--) {
            const orb = context.xpOrbs[i];
            orb.update(orbAttractors, 1, equipmentMagneticMultiplier, effectiveRadiusMultiplier); 
            if (orb.isFinished()) { context.xpOrbs.splice(i, 1); continue; }
            for (const attractor of orbAttractors) {
                const magneticRad = (state.gameMode === 'invasionDefend') ? (attractor.radius + orb.radius) : attractor.radius;
                if (orb.state !== 'collecting' && p.dist(orb.pos.x, orb.pos.y, attractor.pos.x, attractor.pos.y) < magneticRad) {
                    orb.collect();
                    let xpMult = 1.0;
                    if (state.isGoldenTurn) {
                        if (state.skillTreeState['golden_shot_xp_1']) xpMult += 1.0;
                        if (state.skillTreeState['golden_shot_xp_2']) xpMult += 1.0;
                        if (state.skillTreeState['golden_shot_xp_3']) xpMult += 1.0;
                        if (state.skillTreeState['golden_shot_xp_4']) xpMult += 1.0;
                    }
                    const xpAmount = XP_SETTINGS.xpPerOrb * (1 + (state.upgradeableStats.bonusXp || 0)) * magnetMultiplier * xpMult; 
                    if (state.gameMode === 'invasionDefend') {
                        context.runStats.invasionRunCoins = (context.runStats.invasionRunCoins || 0) + 5;
                        ui.renderInvasionShopUI();
                        addXp(xpAmount, context, state);
                        const r = p.canvas.getBoundingClientRect(); ui.animateCoinParticles(r.left + orb.pos.x, r.top + orb.pos.y, 5);
                    } else {
                        state.pendingXp += xpAmount;
                        if(context.levelStats.xpCollected !== undefined) context.levelStats.xpCollected += xpAmount;
                    }
                    context.orbsCollectedThisTurn++;
                    context.xpCollectPitchResetTimer = 30;
                    event.dispatch('XpCollected', { amount: xpAmount, ball: attractor });
                    sounds.orbCollect(context.orbsCollectedThisTurn);
                    const badge = document.getElementById('player-level-badge');
                    if (badge) { badge.classList.add('flash'); setTimeout(()=>badge.classList.remove('flash'), 150); }
                    break;
                }
            }
        }
        updateVFX();
        if (shouldRender) {
             renderGame(p, { ...context, gameState: context.gameState }, {});
             if(state.gameMode === 'invasionDefend' && dom.invasionShopCoinCountEl) dom.invasionShopCoinCountEl.textContent = context.runStats.invasionRunCoins || 0;
             p.handleGameStates();
        }
    }
    
    p.windowResized = () => { 
        const container = document.getElementById('canvas-container'); 
        p.resizeCanvas(container.clientWidth, container.clientHeight); 
        context.splatBuffer.resizeCanvas(container.clientWidth, container.clientHeight); 
        const MaxSize = 580;
        const maxGridUnitSize = MaxSize / GRID_CONSTANTS.TOTAL_COLS;
        context.board.gridUnitSize = p.min(p.width / GRID_CONSTANTS.TOTAL_COLS, p.height / GRID_CONSTANTS.TOTAL_ROWS, maxGridUnitSize);
        context.board.width = GRID_CONSTANTS.TOTAL_COLS * context.board.gridUnitSize;
        context.board.height = GRID_CONSTANTS.TOTAL_ROWS * context.board.gridUnitSize;
        context.board.x = (p.width - context.board.width) / 2;
        context.board.y = (p.height - context.board.height) / 2;
        context.board.border = context.board.gridUnitSize / 2;
        context.board.genX = context.board.x + GRID_CONSTANTS.SAFE_ZONE_GRID * context.board.gridUnitSize;
        context.board.genY = context.board.y + GRID_CONSTANTS.SAFE_ZONE_GRID * context.board.gridUnitSize;
        context.board.cols = GRID_CONSTANTS.BRICK_COLS;
        context.board.rows = GRID_CONSTANTS.BRICK_ROWS;
        if(state.p5Instance) p.setBallSpeedMultiplier(state.originalBallSpeed);
    };

    p.spawnXpOrbs = (count, pos) => { for(let i=0; i<count; i++) context.xpOrbs.push(new XpOrb(p, pos.x, pos.y)); };
    p.handleGameStates = () => { 
        if (context.gameState==='levelComplete'||context.gameState==='gameOver') { 
            if (state.isSpedUp) { state.isSpedUp = false; document.getElementById('speedToggleBtn').textContent = 'Speed Up'; document.getElementById('speedToggleBtn').classList.remove('speed-active'); }
            if (context.gameState === 'levelComplete') {
                if (!context.levelCompleteSoundPlayed) { sounds.levelComplete(); context.levelCompleteSoundPlayed = true; }
                ui.showLevelCompleteModal(context.levelStats, { 
                    getLevelStats: () => context.levelStats, 
                    getRunStats: () => context.runStats, 
                    setRunStats: (s) => context.runStats = s, 
                    getCoins: () => context.coins,
                    setCoins: (v) => context.coins = v,
                    nextLevel: p.nextLevel 
                }, context.level);
            } else { 
                if (state.isDebugView) p.toggleDebugView(true);
                if (!context.gameOverSoundPlayed) { sounds.gameOver(); context.gameOverSoundPlayed = true; }
                context.runStats.bestCombo = context.runMaxCombo;
                ui.showGameOverModal('Game Over', true, context.runStats, context.level, state.gameMode);
            }
        } 
    };

    p.getSketch = () => p;
};
