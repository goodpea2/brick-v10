// inputHandlers.js - Mouse and Touch event handlers

import { AIMING_SETTINGS, BRICK_STATS, BALL_STATS } from './balancing.js';
import { PowerupVFX } from './vfx.js';
import * as levelEditor from './levelEditor.js';
import * as event from './eventManager.js';
import * as dom from './dom.js';
import { handleBrickSpawnPowerup, handleCrossBrickSpawnPowerup, handleHollowBrickPowerup } from './spawnBrick.js';
import { harvestFood, harvestWood, processBrokenBricks } from './brickLogic.js';
import { Ball } from './ball.js';
import { sounds } from './sfx.js';

export function setupInput(p, context, state) {
    let canInitiateDrag = false;

    p.mouseClicked = (evt) => {
        if (p.isModalOpen || evt.target !== p.canvas) return;
        if (state.isEditorMode) {
            levelEditor.handleMousePressed(p, context.board, context.bricks, context.shockwaves);
            return;
        }
    };

    p.mousePressed = (evt) => {
        if (p.isModalOpen || evt.target !== p.canvas) return;

        const gridC = Math.floor((p.mouseX - context.board.genX) / context.board.gridUnitSize);
        const gridR = Math.floor((p.mouseY - context.board.genY) / context.board.gridUnitSize);
        let clickedBrick = null;
        if (gridC >= 0 && gridC < context.board.cols && gridR >= 0 && gridR < context.board.rows) {
            clickedBrick = (state.gameMode === 'homeBase' ? context.homeBaseBricks : context.bricks)[gridC][gridR];
        }

        if (state.gameMode === 'homeBase' && state.isMovingOverlay) {
            handleOverlayMove(p, context, state, clickedBrick);
            return;
        }
    
        if (state.gameMode === 'invasionDefend' && context.gameState === 'aiming') {
            handleInvasionDefendInput(p, context, clickedBrick);
            return;
        }
        
        if (state.isEditorMode) {
            levelEditor.handleMousePressed(p, context.board, context.bricks, context.shockwaves);
            return;
        }
        
        if ((state.gameMode === 'homeBase' && !state.isEditorMode)) {
            handleHomeBaseInput(p, context, clickedBrick);
            return;
        }

        if (state.isDebugView) {
             if (clickedBrick) {
                 const hitResult = clickedBrick.hit(10, 'debug_click', context.board);
                 if (hitResult) p.processEvents([{ type: 'brick_hit', ...hitResult, brick: clickedBrick }]);
                 return;
             }
        }
        
        // --- Ball Powerup Trigger ---
        if ((context.gameState === 'playing' || context.gameState === 'levelClearing') && context.ballsInPlay.length > 0) {
            handleActiveBallClick(p, context, state);
            return;
        }

        if (context.gameState === 'levelClearing') return;

        // --- Aiming Start ---
        if (context.gameState === 'aiming' && context.ballsInPlay.length > 0) { 
            const ball = context.ballsInPlay[0];
            const clickInBoard = p.mouseY > context.board.y && p.mouseY < context.board.y + context.board.height && p.mouseX > context.board.x && p.mouseX < context.board.x + context.board.width;
            if (clickInBoard) { 
                context.isAiming = true;
                dom.leftContextPanel.classList.add('hidden');
                context.endAimPos = p.createVector(p.mouseX, p.mouseY); 
                
                // Snap ball to closest wall
                snapBallToWall(p, context.board, ball);
            }
        } 
    };

    p.mouseDragged = (evt) => {
        if (p.isModalOpen) return;
        if ((evt && evt.target !== p.canvas) || (!p.mouseIsPressed && p.touches.length === 0)) return;

        // Determine Dragged Logic
        if (state.gameMode === 'invasionDefend' && (context.gameState === 'aiming' || context.gameState === 'playing')) {
            if (context.draggedBrick) return false; 
            return false;
        }
        
        if ((state.gameMode === 'homeBase' && !state.isEditorMode)) {
            if (context.draggedBrick) return;
            
            // Drag Harvest Logic
            const gridC = Math.floor((p.mouseX - context.board.genX) / context.board.gridUnitSize);
            const gridR = Math.floor((p.mouseY - context.board.genY) / context.board.gridUnitSize);
            if (gridC >= 0 && gridC < context.board.cols && gridR >= 0 && gridR < context.board.rows) {
                const brick = context.homeBaseBricks[gridC][gridR];
                if (brick && !context.homeBaseHarvestedThisDrag.has(brick)) {
                    if (brick.food > 0) {
                        if (harvestFood(brick, { homeBaseBricks: context.homeBaseBricks, board: context.board, p, flyingIcons: context.flyingIcons, gameController: p })) {
                            context.homeBaseHarvestedThisDrag.add(brick);
                        }
                    } else if (brick.type === 'LogBrick') {
                        harvestWood(brick, { homeBaseBricks: context.homeBaseBricks, board: context.board, p, flyingIcons: context.flyingIcons, gameController: p });
                        context.homeBaseHarvestedThisDrag.add(brick);
                    }
                }
            }
            return;
        }
        
        if (state.isEditorMode) {
            levelEditor.handleMouseDragged(p, context.board, context.bricks, context.shockwaves);
            return false;
        }
        if (context.isAiming && context.ballsInPlay.length > 0) {
            context.endAimPos.set(p.mouseX, p.mouseY);
        }
    };

    p.mouseReleased = (evt) => { 
        if (context.draggedBrick) {
            handleDragDrop(p, context, state);
            return;
        }

        if (state.gameMode === 'homeBase') {
            context.homeBaseHarvestedThisDrag.clear();
        }
        if (state.isEditorMode) {
            levelEditor.handleMouseReleased();
            return;
        }
        if (context.isAiming && context.ballsInPlay.length > 0) { 
            handleAimRelease(p, context, state);
        } 
    };

    p.touchStarted = (evt) => { if(evt.target!==p.canvas)return; if(p.touches.length>0)p.mousePressed(evt); return false; };
    p.touchMoved = (evt) => { if(evt.target!==p.canvas)return; if(p.touches.length>0)p.mouseDragged(evt); if(context.isAiming || state.isEditorMode || state.gameMode === 'homeBase' || (state.gameMode === 'invasionDefend' && context.gameState === 'aiming'))return false; };
    p.touchEnded = (evt) => { if(evt.target!==p.canvas)return; p.mouseReleased(); return false; };

    // --- Helper Functions for Inputs ---

    function snapBallToWall(p, board, ball) {
        let distTop=p.abs(p.mouseY-board.y),distBottom=p.abs(p.mouseY-(board.y+board.height)),distLeft=p.abs(p.mouseX-board.x),distRight=p.abs(p.mouseX-(board.x+board.width)); 
        let minDist=p.min(distTop,distBottom,distLeft,distRight); 
        let shootX,shootY; 
        if(minDist===distTop){ shootX=p.mouseX; shootY=board.y+board.border/2+ball.radius; } 
        else if(minDist===distBottom){ shootX=p.mouseX; shootY=board.y+board.height-board.border/2-ball.radius; } 
        else if(minDist===distLeft){ shootX=board.x+board.border/2+ball.radius; shootY=p.mouseY; } 
        else { shootX=board.x+board.width-board.border/2-ball.radius; shootY=p.mouseY; } 
        ball.pos.set(shootX, shootY);
    }

    function handleOverlayMove(p, context, state, clickedBrick) {
        // ... (unchanged)
        const isValidTarget = clickedBrick && clickedBrick.type === 'normal' && !clickedBrick.overlayId;
        if (isValidTarget) {
            const overlay = state.overlayInventory.find(o => o.id === state.isMovingOverlay);
            if (overlay) {
                // Clear old host
                let oldHost = null;
                const allBricks = new Set();
                for(let r=0; r<context.board.rows; r++) for(let c=0; c<context.board.cols; c++) if(context.homeBaseBricks[c][r]) allBricks.add(context.homeBaseBricks[c][r]);
                allBricks.forEach(b => { if (b.id === overlay.hostBrickId) oldHost = b; });
                
                if (oldHost) {
                    oldHost.overlayId = null; oldHost.overlay = null; oldHost.retaliateDamage = 0; delete oldHost.sniperCharge;
                }

                clickedBrick.overlayId = overlay.id;
                clickedBrick.overlay = overlay.type;
                overlay.hostBrickId = clickedBrick.id;
                
                if (overlay.type === 'spike') clickedBrick.retaliateDamage = overlay.retaliateDamage || BRICK_STATS.spike.damage;
                if (overlay.type === 'sniper') clickedBrick.sniperCharge = 0;

                state.isMovingOverlay = null;
                event.dispatch('BrickSelected', { brick: clickedBrick });
                sounds.selectBall();
            }
        } else {
             p.addFloatingText("Invalid Target", p.color(255, 100, 100), { isBold: true });
             state.isMovingOverlay = null;
             if (context.selectedBrick) event.dispatch('BrickSelected', { brick: context.selectedBrick });
        }
    }

    function handleActiveBallClick(p, context, state) {
        if (context.sharedBallStats.uses > 0) {
            const usesBeforeDecrement = context.sharedBallStats.uses;
            context.sharedBallStats.uses--;
            const activeBallType = context.ballsInPlay[0].type;
            const ball = context.ballsInPlay[0];

            // Special Brick Spawn Handling
            for (const b of context.ballsInPlay) {
                // Peek at effect to decide which handler to use
                const result = b.usePowerUp(context.board, { isPeek: true }); 
                const effect = result?.effect;
                
                if (effect) {
                    if (effect.type === 'spawn_bricks') {
                        handleBrickSpawnPowerup(effect, { 
                             p, board: context.board, bricks: context.bricks, 
                             processEvents: p.processEvents, processBrokenBricks: processBrokenBricks,
                             ballsInPlay: context.ballsInPlay, sharedBallStats: context.sharedBallStats, 
                             levelStats: context.levelStats, floatingTexts: context.floatingTexts, 
                             shockwaves: context.shockwaves, particles: context.particles, sounds, 
                             gameStateRef: {value: context.gameState}, ballsLeftRef: {value: context.ballsLeft},
                             gameController: p, BRICK_STATS, runStats: context.runStats
                        });
                    } else if (effect.type === 'spawn_cross_bricks') {
                        handleCrossBrickSpawnPowerup(effect, {
                             p, board: context.board, bricks: context.bricks, 
                             processEvents: p.processEvents, processBrokenBricks: processBrokenBricks,
                             ballsInPlay: context.ballsInPlay, sharedBallStats: context.sharedBallStats, 
                             levelStats: context.levelStats, floatingTexts: context.floatingTexts, 
                             shockwaves: context.shockwaves, particles: context.particles, sounds, 
                             gameStateRef: {value: context.gameState}, ballsLeftRef: {value: context.ballsLeft},
                             gameController: p, BRICK_STATS, runStats: context.runStats
                        });
                    } else if (effect.type === 'hollow_push') {
                        handleHollowBrickPowerup(effect, {
                             p, board: context.board, bricks: context.bricks, 
                             processEvents: p.processEvents, processBrokenBricks: processBrokenBricks,
                             ballsInPlay: context.ballsInPlay, sharedBallStats: context.sharedBallStats, 
                             levelStats: context.levelStats, floatingTexts: context.floatingTexts, 
                             shockwaves: context.shockwaves, particles: context.particles, sounds, 
                             gameStateRef: {value: context.gameState}, ballsLeftRef: {value: context.ballsLeft},
                             gameController: p, BRICK_STATS, runStats: context.runStats
                        });
                    }
                }
            }

            event.dispatch('PowerUpUsed', { ball, powerUpType: activeBallType });
    
            // Get audio/visual template from the clicked ball
            const powerUpTemplate = ball.usePowerUp(context.board, { isPeek: true }); 
            
            if (!powerUpTemplate) return;
    
            if (powerUpTemplate.sound) sounds[powerUpTemplate.sound]();
    
            // Apply Power Up effects to ALL balls
            for (const b of context.ballsInPlay) {
                b.powerUpUses = usesBeforeDecrement;
                if (powerUpTemplate.vfx) context.powerupVFXs.push(new PowerupVFX(p, b.pos.x, b.pos.y));
    
                // EXECUTE Power Up (side effects applied here)
                const effect = b.usePowerUp(context.board, { isPeek: false })?.effect;
                
                if (effect && !['spawn_bricks', 'spawn_cross_bricks', 'hollow_push'].includes(effect.type)) {
                    if (effect.type === 'explode') p.explode(effect.pos, effect.radius, state.upgradeableStats.powerExplosionDamage, 'ball');
                    if (effect.type === 'spawn_miniballs') {
                        if (b.isDying) effect.miniballs.forEach(mb => mb.mainBallIsDead = true);
                        context.miniBalls.push(...effect.miniballs);
                    }
                    if (effect.type === 'spawn_projectiles') context.projectiles.push(...effect.projectiles);
                    if (effect.type === 'spawn_homing_projectile') p.spawnHomingProjectile(b.pos.copy(), null, b);
                }
            }
        }
    }
    
    // ... (rest of file unchanged: handleHomeBaseInput, handleInvasionDefendInput, handleDragDrop, handleAimRelease)
    function handleHomeBaseInput(p, context, clickedBrick) {
        const bricksToInteract = context.homeBaseBricks;
        context.homeBaseHarvestedThisDrag.clear();

        if (context.draggedBrick) return;

        if (clickedBrick) {
            if (clickedBrick.food > 0) {
                if (harvestFood(clickedBrick, { homeBaseBricks: context.homeBaseBricks, board: context.board, p, flyingIcons: context.flyingIcons, gameController: p })) {
                    context.homeBaseHarvestedThisDrag.add(clickedBrick);
                    return;
                }
            }
            if (clickedBrick.type === 'LogBrick') {
                harvestWood(clickedBrick, { homeBaseBricks: context.homeBaseBricks, board: context.board, p, flyingIcons: context.flyingIcons, gameController: p });
                context.homeBaseHarvestedThisDrag.add(clickedBrick);
                return;
            }

            if (context.selectedBrick && clickedBrick === context.selectedBrick) {
                canInitiateDrag = true;
                context.draggedBrick = context.selectedBrick;
                context.draggedBrickOriginalPos = { c: context.selectedBrick.c, r: context.selectedBrick.r };
                const rootC = context.draggedBrick.c + 6;
                const rootR = context.draggedBrick.r + 6;
                for (let i = 0; i < context.draggedBrick.widthInCells; i++) {
                    for (let j = 0; j < context.draggedBrick.heightInCells; j++) {
                        if (bricksToInteract[rootC + i] && bricksToInteract[rootC + i][rootR + j] === context.draggedBrick) {
                            bricksToInteract[rootC + i][rootR + j] = null;
                        }
                    }
                }
                return;
            } else {
                context.selectedBrick = clickedBrick;
                canInitiateDrag = false; 
            }
        } else {
            context.selectedBrick = null;
            canInitiateDrag = false;
        }
        event.dispatch('BrickSelected', { brick: context.selectedBrick });
    }
    
    function handleInvasionDefendInput(p, context, clickedBrick) {
        if (context.draggedBrick) return;

        if (context.selectedBrick && clickedBrick === context.selectedBrick) {
            context.draggedBrick = context.selectedBrick;
            context.draggedBrickOriginalPos = { c: context.selectedBrick.c, r: context.selectedBrick.r };
            const rootC = context.draggedBrick.c + 6;
            const rootR = context.draggedBrick.r + 6;
            for (let i = 0; i < context.draggedBrick.widthInCells; i++) {
                for (let j = 0; j < context.draggedBrick.heightInCells; j++) {
                    if (context.bricks[rootC + i] && context.bricks[rootC + i][rootR + j] === context.draggedBrick) {
                        context.bricks[rootC + i][rootR + j] = null;
                    }
                }
            }
            return;
        }
        context.selectedBrick = clickedBrick;
        event.dispatch('BrickSelected', { brick: context.selectedBrick });
    }

    function handleDragDrop(p, context, state) {
        const bricksToModify = (state.gameMode === 'homeBase' || state.gameMode === 'invasionDefend') ? ((state.gameMode === 'homeBase') ? context.homeBaseBricks : context.bricks) : null;
        if (!bricksToModify) {
            context.draggedBrick = null;
            return;
        }
        const gridC = Math.floor((p.mouseX - context.board.genX) / context.board.gridUnitSize);
        const gridR = Math.floor((p.mouseY - context.board.genY) / context.board.gridUnitSize);
        
        let isValidDrop = true;
        for (let i = 0; i < context.draggedBrick.widthInCells; i++) {
            for (let j = 0; j < context.draggedBrick.heightInCells; j++) {
                const targetC = gridC + i;
                const targetR = gridR + j;
                if (targetC < 0 || targetC >= context.board.cols || targetR < 0 || targetR >= context.board.rows || bricksToModify[targetC][targetR]) {
                    isValidDrop = false; break;
                }
            }
            if (!isValidDrop) break;
        }

        if (isValidDrop) {
            context.draggedBrick.c = gridC - 6;
            context.draggedBrick.r = gridR - 6;
            for (let i = 0; i < context.draggedBrick.widthInCells; i++) for (let j = 0; j < context.draggedBrick.heightInCells; j++) bricksToModify[gridC + i][gridR + j] = context.draggedBrick;
        } else {
            const originalGridC = context.draggedBrickOriginalPos.c + 6;
            const originalGridR = context.draggedBrickOriginalPos.r + 6;
            context.draggedBrick.c = context.draggedBrickOriginalPos.c;
            context.draggedBrick.r = context.draggedBrickOriginalPos.r;
            for (let i = 0; i < context.draggedBrick.widthInCells; i++) for (let j = 0; j < context.draggedBrick.heightInCells; j++) bricksToModify[originalGridC + i][originalGridR + j] = context.draggedBrick;
        }
        
        context.draggedBrick = null;
        context.draggedBrickOriginalPos = null;
        context.selectedBrick = null; 
        event.dispatch('BrickSelected', { brick: null });
    }

    function handleAimRelease(p, context, state) {
        const ball = context.ballsInPlay[0];
        context.ghostBalls = [];
        const cancelRadius = ball.radius * AIMING_SETTINGS.AIM_CANCEL_RADIUS_MULTIPLIER; 
        if (p.dist(context.endAimPos.x, context.endAimPos.y, ball.pos.x, ball.pos.y) < cancelRadius) {
            context.isAiming = false;
            dom.leftContextPanel.classList.remove('hidden');
            return;
        }
        
        let aimDir = p.constructor.Vector.sub(context.endAimPos, ball.pos);
        if (aimDir.magSq() > 1) {
            // Check for Launch Cost first if charge is used
            const ballStats = BALL_STATS.types[ball.type];
            if (ballStats && ballStats.launchCost > 0) {
                if (state.runCharge < ballStats.launchCost) {
                    // Cannot launch, reset aiming
                     context.isAiming = false;
                     dom.leftContextPanel.classList.remove('hidden');
                     if(p.addFloatingText) p.addFloatingText("Not Enough Charge!", p.color(255, 100, 100), { isBold: true });
                     return;
                }
            }

            let ballConsumed = false;
            if (state.gameMode === 'trialRun') {
                if (state.trialRunBallStock[ball.type] > 0) {
                    state.trialRunBallStock[ball.type]--;
                    ballConsumed = true;
                }
            } else { 
                if (ball.type === 'giant') {
                    if (context.giantBallCount > 0) {
                        context.giantBallCount--;
                        context.isGiantBallTurn = true;
                        ballConsumed = true;
                    }
                } else {
                    if (context.ballsLeft > 0) {
                        context.ballsLeft--;
                        ballConsumed = true;
                    }
                }
            }

            if (!ballConsumed) {
                context.isAiming = false;
                dom.leftContextPanel.classList.remove('hidden');
                return;
            }
            
            // Consume Charge
            if (ballStats && ballStats.launchCost > 0) {
                state.runCharge -= ballStats.launchCost;
            }

            context.levelStats.ballsUsed++;
            
            // Find Instance ID for equipment logic based on selected type
            let instanceIdToUse = null;
            if (state.gameMode === 'adventureRun' && ball.type !== 'giant') {
                // Find first instance of this type in loadout
                // Note: If player has 2 of same type, we just pick first available match.
                // Refinement: Ideally we'd know which specific "card" was selected, but BallSelector selects by Type.
                // Assuming first match is acceptable for now.
                const matchingId = state.currentLoadout.find(id => {
                    if (!id) return false;
                    const b = state.ballInventory.find(inv => inv.instanceId === id);
                    return b && b.type === ball.type;
                });
                instanceIdToUse = matchingId;
            }

            // Update ball with instance data before firing
            ball.instanceId = instanceIdToUse;
            ball.recalculateStats(); // Apply instance-specific stats/enchantments immediately
            
            // Overflow Logic
            let activeType = ball.type;
            const equipment = state.ballEquipment[ball.instanceId] ? state.ballEquipment[ball.instanceId].filter(Boolean) : 
                              (state.ballEquipment[activeType] ? state.ballEquipment[activeType].filter(Boolean) : []);
                              
            const overflow = equipment.find(item => item.id === 'overflow');
            if (overflow && !ball.overflowApplied) {
                ball.maxHp += overflow.value.main;
                ball.hp = ball.maxHp;
                ball.powerUpUses++;
                ball.powerUpMaxUses++;
                ball.overflowApplied = true;
                state.overflowHealCharges = overflow.config.buffingHits;
            }

            // Speed Logic
            let speedMultiplier = 1.0;
            const slowBall = equipment.find(item => item.id === 'slow_ball');
            if (slowBall) speedMultiplier *= slowBall.value;
            const gasTech = equipment.find(item => item.id === 'gas_tech');
            if (gasTech) speedMultiplier *= gasTech.value.speed;

            const baseSpeed = (context.board.gridUnitSize * 0.5) * state.originalBallSpeed * speedMultiplier;
            
            ball.vel = aimDir.normalize().mult(baseSpeed);
            ball.isMoving = true;
            if (!ball.isGhost && ball.type !== 'giant') ball.hp = ball.maxHp;
            
            event.dispatch('TurnStart', { ball });
            context.gameState = 'playing';

            context.sharedBallStats.hp = ball.hp;
            context.sharedBallStats.maxHp = ball.maxHp;
            context.sharedBallStats.uses = ball.powerUpUses;
            context.sharedBallStats.maxUses = ball.powerUpMaxUses;

            state.rampingDamage = 0;
            state.rampingDamageTimer = 0;
            state.orbsForHeal = 0;
        }
        context.isAiming = false; 
        dom.leftContextPanel.classList.remove('hidden');
    }
}
