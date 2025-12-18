// collision.js

import { Ball, MiniBall } from './ball.js';
import { calculateBallDamage } from './ball.js';
import { sounds } from './sfx.js';
import { BALL_STATS, BRICK_STATS } from './balancing.js';
import * as event from './eventManager.js';
import { FloatingText, FlyingIcon } from './vfx.js';
import * as dom from './dom.js';
import { renderTrialLootPanel } from './ui/invasionLoot.js';

function detectCollisionSide(ball, brickRect) {
    const { x: bx, y: by, w, h } = brickRect;
    const { x: px, y: py } = ball.pos;
    const { x: vx, y: vy } = ball.vel;
    const r = ball.radius;

    const left = bx - r;
    const right = bx + w + r;
    const top = by - r;
    const bottom = by + h + r;

    const invVX = vx !== 0 ? 1 / vx : Infinity;
    const invVY = vy !== 0 ? 1 / vy : Infinity;

    const tLeft   = (left   - px) * invVX;
    const tRight  = (right  - px) * invVX;
    const tTop    = (top    - py) * invVY;
    const tBottom = (bottom - py) * invVY;

    const tminX = Math.min(tLeft, tRight);
    const tmaxX = Math.max(tLeft, tRight);
    const tminY = Math.min(tTop, tBottom);
    const tmaxY = Math.max(tTop, tBottom);

    const tEnter = Math.max(tminX, tminY);
    const tExit  = Math.min(tmaxX, tmaxY);

    if (tEnter > tExit || tExit < 0 || tEnter > 1) return null;

    if (tminX > tminY) {
        return vx > 0 ? 'left' : 'right';
    } else {
        return vy > 0 ? 'top' : 'bottom';
    }
}

function resolveBounce(ball, brickRect) {
    const side = detectCollisionSide(ball, brickRect);
    if (!side) return null;

    switch (side) {
        case 'left':
        case 'right':
            ball.vel.x *= -1;
            break;
        case 'top':
        case 'bottom':
            ball.vel.y *= -1;
            break;
    }

    const { x: bx, y: by, w, h } = brickRect;
    const r = ball.radius;

    if (side === 'left') {
        ball.pos.x = bx - r;
    } else if (side === 'right') {
        ball.pos.x = bx + w + r;
    } else if (side === 'top') {
        ball.pos.y = by - r;
    } else if (side === 'bottom') {
        ball.pos.y = by + h + r;
    }

    return side;
}

export function checkCollisions(p, b, board, bricks, combo, state) {
    let hitEvents = [];
    
    const minC = Math.max(0, Math.floor((b.pos.x - b.radius - board.genX) / board.gridUnitSize));
    const maxC = Math.min(board.cols - 1, Math.ceil((b.pos.x + b.radius - board.genX) / board.gridUnitSize));
    const minR = Math.max(0, Math.floor((b.pos.y - b.radius - board.genY) / board.gridUnitSize));
    const maxR = Math.min(board.rows - 1, Math.ceil((b.pos.y + b.radius - board.genY) / board.gridUnitSize));

    for (let c = minC; c <= maxC; c++) {
        for (let r = minR; r <= maxR; r++) {
            const brick = bricks[c][r];
            if (!brick) continue;

            const brickPos = brick.getPixelPos(board);
            const brickWidth = brick.size * brick.widthInCells;
            const brickHeight = brick.size * brick.heightInCells;

            if (b.type === 'giant' && !b.isGhost) {
                const dist = p.dist(b.pos.x, b.pos.y, brickPos.x + brickWidth/2, brickPos.y + brickHeight/2);
                if (dist < b.radius + Math.max(brickWidth, brickHeight)/2 && !b.piercedBricks.has(brick)) {
                    if (b.isDying) {
                        b.handleDeath(board, hitEvents);
                        return hitEvents;
                    }
                    const hitResult = brick.hit(BALL_STATS.types.giant.baseDamage, b, board);
                    if (hitResult) {
                        event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                        hitEvents.push({ type: 'brick_hit', ...hitResult, brick: brick });
                        b.damageDealtForHpLoss += hitResult.damageDealt;
                        if (b.damageDealtForHpLoss >= 100) {
                            const hpToLose = Math.floor(b.damageDealtForHpLoss / 100);
                            const damageEvent = b.takeDamage(hpToLose, 'giant_power');
                            if (damageEvent) hitEvents.push(damageEvent);
                            b.damageDealtForHpLoss %= 100;
                        }
                    }
                    b.piercedBricks.add(brick);
                }
                continue;
            }

            let testX = b.pos.x, testY = b.pos.y;
            if (b.pos.x < brickPos.x) testX = brickPos.x;
            else if (b.pos.x > brickPos.x + brickWidth) testX = brickPos.x + brickWidth;
            if (b.pos.y < brickPos.y) testY = brickPos.y;
            else if (b.pos.y > brickPos.y + brickHeight) testY = brickPos.y + brickHeight;

            const dX = b.pos.x - testX;
            const dY = b.pos.y - testY;
            if (p.sqrt(dX*dX + dY*dY) <= b.radius) {
                if (b.isGhost && b.type === 'giant') continue;
                if (b instanceof Ball && !b.isGhost) b.addHitToHistory();

                if (brick.type === 'LogBrick' && !b.isGhost && !b.brickHitCooldowns.has(brick)) {
                    const hitResult = brick.hit(brick.health, b, board);
                    if (hitResult) {
                        if (b instanceof MiniBall) {
                            event.dispatch('MiniBallHitBrick', { miniBall: b, brick, hitResult, combo });
                        } else {
                            event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                        }
                        hitEvents.push({ type: 'brick_hit', ...hitResult, brick: brick });
                    }
                    b.brickHitCooldowns.set(brick, 3);
                    continue;
                }

                let equipment = [];
                if (typeof b.getActiveEquipment === 'function') {
                    equipment = b.getActiveEquipment();
                } else {
                    const equipmentSourceType = (b instanceof MiniBall) ? b.parentType : b.type;
                    equipment = state.ballEquipment[equipmentSourceType]?.filter(Boolean) || [];
                }

                const phaserItem = equipment.find(e => e.id === 'phaser');
                const isPhasing = (b.type === 'phaser' && b.phaserTimer > 0) || (phaserItem && state.phaserCharges > 0 && b instanceof Ball);
                const isPiercing = (b.type === 'piercing' || b.type === 'grow') && b.isPiercing;

                if ((isPiercing || isPhasing) && b.piercedBricks.has(brick)) {
                    continue;
                }

                if (isPiercing || isPhasing) {
                    if (b.piercedBricks.has(brick)) continue;
                    b.piercedBricks.add(brick);
                    
                    if (isPiercing && b.piercingContactsLeft > 0) {
                        b.piercingContactsLeft--;
                        if (b.piercingContactsLeft <= 0) b.isPiercing = false;
                    }
                    if (phaserItem && state.phaserCharges > 0 && b instanceof Ball) {
                        state.phaserCharges--;
                    }
                    
                    if (!b.isGhost) {
                        if (b.type === 'phaser' && b.phaserTimer > 0) {
                            // Phaser ball logic: ignore bricks direct damage while phasing
                        } else {
                            let damage = calculateBallDamage(b, combo, state);
                            // Apply upgrade bonuses for phasing/piercing
                            if (b.type === 'phaser' && state.upgradeableStats.phaserBonusDamage) damage += state.upgradeableStats.phaserBonusDamage;
                            if (b.type === 'grow' && state.upgradeableStats.growBonusDamage) damage += state.upgradeableStats.growBonusDamage;

                            const hitResult = brick.hit(damage, b, board);
                            if (hitResult) {
                                if (b instanceof MiniBall) {
                                    event.dispatch('MiniBallHitBrick', { miniBall: b, brick, hitResult, combo });
                                } else {
                                    event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                                }
                                hitEvents.push({ type: 'brick_hit', ...hitResult, brick: brick });
                            }
                            
                            let selfDamage = 0;
                            if (b.type === 'piercing') selfDamage = BALL_STATS.types.piercing.brickHitDamage;
                            else if (b.type === 'grow') selfDamage = BALL_STATS.types.grow.brickHitDamage;
                            else if (b.type === 'phaser') selfDamage = BALL_STATS.types.phaser.brickHitDamage;
                            
                            if (selfDamage > 0) {
                                const damageEvent = b.takeDamage(selfDamage, 'brick');
                                if (damageEvent) hitEvents.push(damageEvent);
                            }
                        }
                    }
                    continue;
                }

                const isOnCooldown = b.brickHitCooldowns.has(brick);

                if (state.overflowHealCharges > 0 && b instanceof Ball) {
                    const damage = calculateBallDamage(b, combo, state);
                    brick.buffHealth(damage);
                    state.overflowHealCharges--;
                    sounds.brickHeal();

                    const side = resolveBounce(b, { x: brickPos.x, y: brickPos.y, w: brickWidth, h: brickHeight });
                    if (b instanceof Ball) b.lastHit = { target: 'brick', side };

                    return hitEvents;
                }

                const executioner = equipment.find(e => e.id === 'executioner');
                const isMini = b instanceof MiniBall;
                const executionerApplies = executioner && (!isMini || executioner.value.applyToMini !== false);

                if (executionerApplies && brick.health <= executioner.value.main && !b.isGhost && brick.type !== 'goal') {
                    const hitResult = brick.hit(brick.health, b, board);
                    if (hitResult) {
                        hitResult.brickOverlay = brick.overlay;
                        if (b instanceof MiniBall) {
                            event.dispatch('MiniBallHitBrick', { miniBall: b, brick, hitResult, combo });
                        } else {
                            event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                        }
                        hitEvents.push({ type: 'brick_hit', ...hitResult, brick: brick });
                    }
                } else {
                    const side = resolveBounce(b, { x: brickPos.x, y: brickPos.y, w: brickWidth, h: brickHeight });
                    if (b instanceof Ball) b.lastHit = { target: 'brick', side };

                    if (!b.isGhost && !isOnCooldown) {
                        const damage = calculateBallDamage(b, combo, state);
                        const hitResult = brick.hit(damage, b, board);
                        if (hitResult) {
                            if (brick.retaliateDamage > 0 && !b.isGhost) {
                                let damageEvent = null;
                                if (b instanceof MiniBall) {
                                    damageEvent = { type: 'damage_taken', source: 'retaliation', ballType: b.parentType, damageAmount: brick.retaliateDamage, position: b.pos.copy() };
                                } else if (b instanceof Ball) {
                                    damageEvent = b.takeDamage(brick.retaliateDamage, 'retaliation');
                                }
                                if (damageEvent) hitEvents.push(damageEvent);
                                sounds.spikeRetaliate();
                                
                                if (state.gameMode === 'trialRun' && brick.overlay === 'spike') {
                                    const runStats = p.getRunStats();
                                    if (runStats) {
                                        runStats.totalMetalCollected = (runStats.totalMetalCollected || 0) + 1;
                                        p.addFloatingText('+1 🪨', p.color(192, 192, 192), { isBold: true }, b.pos);
                                        renderTrialLootPanel();
                                    }
                                }
                            }
                            hitResult.brickOverlay = brick.overlay;
                            if (b instanceof MiniBall) {
                                event.dispatch('MiniBallHitBrick', { miniBall: b, brick, hitResult, combo });
                            } else {
                                event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                            }
                            hitEvents.push({ type: 'brick_hit', ...hitResult, brick: brick });
                        }
                        b.brickHitCooldowns.set(brick, 3);

                        if (b instanceof Ball) {
                            const impactDistributor = equipment.find(item => item.id === 'impact_distributor');
                            if (impactDistributor) {
                                const damageEvent = b.takeDamage(0, 'brick');
                                if (damageEvent) hitEvents.push(damageEvent);
                            }
                        }
                    }

                    if (!b.isGhost && (b.type === 'piercing' || b.type === 'grow' || b.type === 'phaser') && !isOnCooldown) {
                        let selfDamage = 0;
                        if (b.type === 'piercing') selfDamage = BALL_STATS.types.piercing.brickHitDamage;
                        else if (b.type === 'grow') selfDamage = BALL_STATS.types.grow.brickHitDamage;
                        else if (b.type === 'phaser') selfDamage = BALL_STATS.types.phaser.brickHitDamage;

                        if (selfDamage > 0) {
                            const damageEvent = b.takeDamage(selfDamage, 'brick');
                            if (damageEvent) hitEvents.push(damageEvent);
                        }
                    }
                }
                return hitEvents;
            }
        }
    }

    return hitEvents;
}