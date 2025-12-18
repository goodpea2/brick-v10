
// ball.js 
import { state } from './state.js';
import { BALL_STATS, ENCHANTMENT_OUTCOMES } from './balancing.js';
import * as event from './eventManager.js';
import { handleBrickSpawnPowerup, handleCrossBrickSpawnPowerup, handleHollowBrickPowerup } from './spawnBrick.js';

let brickSprite;

function drawGlossyCircle(buffer, pos, radius, color) {
    // Main circle
    buffer.fill(color);
    buffer.noStroke();
    buffer.ellipse(pos.x, pos.y, radius * 2);

    // Inset shadow effect
    buffer.noFill();
    const shadowGradient = buffer.drawingContext.createRadialGradient(
        pos.x, pos.y, 0,
        pos.x, pos.y, radius
    );
    shadowGradient.addColorStop(0.7, 'rgba(0,0,0,0)');
    shadowGradient.addColorStop(1, 'rgba(0,0,0,0.5)');
    buffer.drawingContext.fillStyle = shadowGradient;
    buffer.ellipse(pos.x, pos.y, radius * 2);

    // Glossy highlight effect
    const highlightX = pos.x - radius * 0.3;
    const highlightY = pos.y - radius * 0.3;
    const highlightW = radius * 0.6;
    const highlightH = radius * 0.5;
    buffer.fill(255, 255, 255, 120);
    buffer.noStroke();
    buffer.ellipse(highlightX, highlightY, highlightW, highlightH);
}

function getActiveEquipmentForBallType(ballType) {
    if (!ballType || !state.ballEquipment[ballType]) return [];
    return state.ballEquipment[ballType].filter(Boolean);
}

export function calculateBallDamage(ball, combo, state) {
    if (!ball) return 10;
    const equipmentSourceType = (ball instanceof MiniBall) ? ball.parentType : ball.type;
    if (!equipmentSourceType || !BALL_STATS.types[equipmentSourceType]) return 10; 

    const equipment = ball.getActiveEquipment();
    let damage;
    const isMini = ball instanceof MiniBall;

    // Special override: Trash Bin
    const trashBin = equipment.find(item => item.id === 'trash_bin');
    if (trashBin) {
        if (!isMini || trashBin.value.applyToMini) {
            return trashBin.config.setDamage; 
        }
    }
    
    // Special override: Nullifier
    const nullifier = equipment.find(item => item.id === 'nullifier');
    if (nullifier && ball.nullifierCooldown > 0) {
        if (!isMini || nullifier.value.applyToMini) {
            return 0; 
        }
    }

    // Apply enchantment damage multiplier
    let damageMultiplier = 1.0;
    const instanceIdToUse = (ball instanceof MiniBall) ? ball.parentInstanceId : ball.instanceId;
    
    if (instanceIdToUse) {
        const instance = state.ballInventory.find(b => b.instanceId === instanceIdToUse);
        if (instance && instance.outcomes) {
            let computedStats = { damageMultiplier: 1.0 };
            instance.outcomes.forEach(key => {
                const outcomeDef = ENCHANTMENT_OUTCOMES[equipmentSourceType][key];
                if (outcomeDef) outcomeDef.apply(computedStats);
            });
            damageMultiplier = computedStats.damageMultiplier;
        }
    } else {
        const enchantmentData = state.ballEnchantments[equipmentSourceType];
        if (enchantmentData) {
            damageMultiplier = enchantmentData.damageMultiplier;
        }
    }

    if (isMini) {
        damage = BALL_STATS.types.miniball.baseDamage; 
        // Additive Mini Damage from Shop - include Cell type
        const miniBonusKey = {
            split: 'split_spawned_miniball_damage',
            cluster: 'cluster_spawned_miniball_damage',
            cell: 'cell_spawned_miniball_damage'
        }[ball.parentType];
        if (miniBonusKey) damage += (state.upgradeBonuses[miniBonusKey] || 0);
    } else {
        damage = BALL_STATS.types[equipmentSourceType].baseDamage;
        
        // Additive Direct Damage from Shop
        if (ball.type === 'classic') damage += (state.upgradeBonuses.classic_directDamage || 0);
        else if (ball.type === 'strong') damage += (state.upgradeBonuses.strong_directDamage || 0);
        else if (ball.type === 'seeker') damage += (state.upgradeBonuses.seeker_directDamage || 0);
        
        // Additive Power-up Stacking Buff
        if (ball.powerUpDirectDamageStack) {
            damage += ball.powerUpDirectDamageStack;
        }
    }
    
    damage *= damageMultiplier;

    equipment.forEach(item => {
        if (!item) return;
        switch (item.id) {
            case 'direct_damage': damage += isMini ? item.value.mini : item.value.main; break;
            case 'deconstructor': damage += isMini ? item.value.mini : item.value.main; break;
            case 'combo_damage': damage += (combo || 0) * (isMini ? item.value.mini : item.value.main); break;
            case 'damage_reduction': if (!isMini || item.value.applyToMini) damage *= (1 - item.value.main); break;
            case 'nullifier': if (!isMini || item.value.applyToMini) damage += item.config.damageBuff; break;
        }
    });
    
    const rampingDamageItem = equipment.find(item => item.id === 'ramping_damage');
    if (rampingDamageItem) damage += state.rampingDamage;
    
    if (ball.burningDamageStack > 0) damage += ball.burningDamageStack;

    return Math.max(1, Math.floor(damage));
}

export class Projectile {
    constructor(p, pos, vel, damage, { piercesBricks = false } = {}) {
        this.p = p;
        this.pos = pos;
        this.vel = vel;
        this.damage = damage;
        this.radius = 6;
        this.isDead = false;
        this.lifespan = 120;
        this.piercesBricks = piercesBricks;
    }

    update(board, bricks) {
        this.pos.add(this.vel);
        this.lifespan--;
        if (this.lifespan <= 0) {
            this.isDead = true;
            return null;
        }

        if (this.pos.x < board.x || this.pos.x > board.x + board.width || this.pos.y < board.y || this.pos.y > board.y + board.height) {
            this.isDead = true;
            return null;
        }

        if (!this.piercesBricks) {
            const gridC = Math.floor((this.pos.x - board.genX) / board.gridUnitSize);
            const gridR = Math.floor((this.pos.y - board.genY) / board.gridUnitSize);

            if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
                const brick = bricks[gridC][gridR];
                if (brick) {
                    this.isDead = true;
                    const hitResult = brick.hit(this.damage, 'projectile', board);
                    if (hitResult) {
                        return { type: 'brick_hit', ...hitResult, source: 'projectile' };
                    }
                }
            }
        }
        return null;
    }

    draw() {
        this.p.push();
        this.p.translate(this.pos.x, this.pos.y);
        this.p.rotate(this.vel.heading());
        this.p.fill(255, 255, 0);
        this.p.noStroke();
        const height = 6; 
        this.p.rect(-this.radius, -height / 2, this.radius * 2, height);
        this.p.pop();
    }
}

export class SniperProjectile extends Projectile {
    constructor(p, pos, vel, damage, { piercesBricks = true } = {}) {
        super(p, pos, vel, damage, { piercesBricks });
        this.radius = 16; 
        this.color = p.color(255, 40, 40); 
    }

    draw() {
        this.p.push();
        this.p.translate(this.pos.x, this.pos.y);
        this.p.rotate(this.vel.heading());
        const height = 4;
        this.p.noStroke();
        this.p.fill(255, 100, 100, 100);
        this.p.rect(-this.radius - 2, -height, (this.radius + 2) * 2, height * 2);
        this.p.fill(this.color);
        this.p.rect(-this.radius, -height / 2, this.radius * 2, height);
        this.p.pop();
    }
}

export class HomingProjectile {
    constructor(p, pos, vel, damage, target, radius, turnRate, board, bonusExplosionRadius = 0) {
        this.p = p;
        this.pos = pos;
        this.vel = vel;
        this.damage = damage;
        this.target = target;
        this.radius = radius;
        this.isDead = false;
        this.maxSpeed = 3;
        this.turnRate = turnRate;
        this.board = board;
        this.bonusExplosionRadius = bonusExplosionRadius;
    }

    update(board, bricks) {
        if (this.target && this.target.health > 0) {
            const targetPos = this.target.getPixelPos(board).add(this.target.size / 2, this.target.size / 2);
            const desiredVel = this.p.constructor.Vector.sub(targetPos, this.pos);
            const dist = desiredVel.mag();
            desiredVel.normalize();
            desiredVel.mult(this.maxSpeed);

            const steer = this.p.constructor.Vector.sub(desiredVel, this.vel);
            steer.limit(this.turnRate); 
            this.vel.add(steer);
            this.vel.limit(this.maxSpeed);
            
            if (dist < this.target.size * 0.5) {
                this.pos.set(targetPos);
            }
        } else {
            this.vel.mult(1.05);
            this.vel.limit(this.maxSpeed * 1.5);
        }

        this.pos.add(this.vel);

        if (this.pos.x < board.x || this.pos.x > board.x + board.width || this.pos.y < board.y || this.pos.y > board.y + board.height) {
            this.isDead = true;
            return null;
        }

        const gridC = Math.floor((this.pos.x - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((this.pos.y - board.genY) / board.gridUnitSize);
        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
            if (bricks[gridC][gridR]) {
                this.isDead = true;
                const explosionRadius = this.radius + (this.board.gridUnitSize * this.bonusExplosionRadius);
                return { type: 'homing_explode', pos: this.pos, radius: explosionRadius, damage: this.damage };
            }
        }
        return null;
    }

    draw() {
        this.p.noStroke();
        const a = this.p.map(this.p.sin(this.p.frameCount * 0.2), -1, 1, 0, 255);
        this.p.fill(255, 100, 0, a);
        this.p.ellipse(this.pos.x, this.pos.y, 17);
        this.p.fill(255, 200, 0);
        this.p.ellipse(this.pos.x, this.pos.y, 12);
    }
}

export class MiniBall {
    constructor(p, x, y, vel, gridUnitSize, parentType, parentInstanceId = null) { 
        this.p = p;
        this.pos = p.createVector(x,y); 
        this.vel = vel; 
        
        this.gridUnitSize = gridUnitSize;
        this.parentType = parentType;
        this.parentInstanceId = parentInstanceId;
        this.type = 'miniball';
        this.brickHitCooldowns = new Map();
        this.isDead = false;
        this.isDying = false; 
        this.mainBallIsDead = false;
        this.isGhost = false;
        
        this.maxHp = 10;
        this.hp = this.maxHp;
        
        this.recalculateStats();
        
        this.burningCoreTimer = 0;
        this.burningDamageStack = 0;
        this.spinningSpikeTimer = 0;
        this.spinningSpikeAngle = 0;
        this.nullifierCooldown = 0;
        this.clingyTimer = 0;
        this.breadCrumbTimer = 0;
        this.consecutiveWallHits = 0;
        this.lastWallHitFrame = -999;
        this.previousWallHitFrame = -999;
        
        const equipment = this.getActiveEquipment();
        const doomTicker = equipment.find(e => e.id === 'doom_ticker');
        if (doomTicker) {
            this.doomTickerDamage = doomTicker.config.miniBaseDamage;
            this.doomTickerTimer = 60;
        } else {
            this.doomTickerDamage = 0;
        }
    }

    getActiveEquipment() {
        if (this.parentInstanceId && state.ballEquipment[this.parentInstanceId]) {
            return state.ballEquipment[this.parentInstanceId].filter(Boolean);
        }
        return getActiveEquipmentForBallType(this.parentType);
    }

    recalculateStats() {
        const equipment = this.getActiveEquipment();
        let baseRadiusMult = BALL_STATS.types.miniball.radiusMultiplier;
        let areaAdd = 0;
        
        const enlargement = equipment.find(e => e.id === 'enlargement');
        if (enlargement && enlargement.value.applyToMini) {
            areaAdd += enlargement.value.miniAdd; 
        }
        
        const areaFactor = 1.0 + areaAdd;
        this.radius = this.gridUnitSize * baseRadiusMult * Math.sqrt(areaFactor);

        const trashBin = equipment.find(e => e.id === 'trash_bin');
        if (trashBin && trashBin.value.applyToMini) {
            this.maxHp = trashBin.config.setHp;
            this.hp = Math.min(this.hp, this.maxHp);
        }
    }

    takeDamage(amount, source = 'brick', position = this.pos) {
        return { type: 'damage_taken', source, ballType: this.parentType, damageAmount: amount, position: position.copy() };
    }

    handleDeath(board, hitEvents) {
        if (this.isDead) return;
        this.isDead = true;
        if (this.doomTickerDamage > 0) {
            const equipment = this.getActiveEquipment();
            const tickerItem = equipment.find(e => e.id === 'doom_ticker');
            const radius = tickerItem ? tickerItem.config.miniRadiusTiles : 2.5;
            this.p.explode(this.pos.copy(), board.gridUnitSize * radius, this.doomTickerDamage, 'doom_ticker');
        }
        hitEvents.push({ type: 'dying_ball_death', pos: this.pos.copy() });
    }

    update(board, checkBrickCollisions) {
        const equipment = this.getActiveEquipment();
        
        if (this.nullifierCooldown > 0) this.nullifierCooldown--;
        if (this.clingyTimer > 0) this.clingyTimer--;

        // Burning Core
        const burningCore = equipment.find(e => e.id === 'burning_core');
        if (burningCore && burningCore.value.applyToMini) {
            this.burningCoreTimer++;
            if (this.burningCoreTimer >= burningCore.config.tickFrames) {
                this.burningCoreTimer = 0;
                this.burningDamageStack += burningCore.value.miniStack;
                this.takeDamage(burningCore.config.hpLoss, 'burning_core');
            }
        }
        
        // Spinning Spikes
        const spinningSpikes = equipment.find(e => e.id === 'spinning_spikes');
        if (spinningSpikes && spinningSpikes.value.applyToMini) {
            this.spinningSpikeTimer++;
            if (this.spinningSpikeTimer >= spinningSpikes.value.miniInterval * 60) {
                this.spinningSpikeTimer = 0;
                const angle = (this.p.PI / 4) * this.spinningSpikeAngle;
                this.spinningSpikeAngle = (this.spinningSpikeAngle + 1) % 8;
                const speed = board.gridUnitSize * 0.4;
                const vel = this.p.constructor.Vector.fromAngle(angle).mult(speed);
                if (this.p.spawnProjectile) { 
                     const proj = new Projectile(this.p, this.pos.copy(), vel, spinningSpikes.config.damage);
                     this.p.addProjectiles([proj]);
                }
            }
        }
        
        // Doom Ticker
        if (this.doomTickerDamage > 0) {
            this.doomTickerTimer--;
            if (this.doomTickerTimer <= 0) {
                this.doomTickerTimer = 60;
                const tickerItem = equipment.find(e => e.id === 'doom_ticker');
                if (tickerItem) {
                     const decay = tickerItem.value;
                     this.doomTickerDamage = Math.max(0, this.doomTickerDamage * (1 - decay) - tickerItem.config.decayFixed);
                }
            }
        }
        
        if (this.hp <= 0 && !this.isDying) {
            this.isDying = true;
        }
        
        if (this.mainBallIsDead) {
            let events = [];
            this.handleDeath(board, events);
            return events;
        }

        for (const [brick, cooldown] of this.brickHitCooldowns.entries()) {
            if (cooldown - 1 <= 0) {
                this.brickHitCooldowns.delete(brick);
            } else {
                this.brickHitCooldowns.set(brick, cooldown - 1);
            }
        }

        const speed = this.vel.mag();
        const clingyItem = equipment.find(e => e.id === 'clingy');
        const speedMult = this.clingyTimer > 0 ? (clingyItem ? clingyItem.config.speedMult : 0.2) : 1.0;
        const effectiveSpeed = speed * speedMult;
        
        const steps = Math.ceil(effectiveSpeed / (this.radius * 0.8));
        if (steps <= 0) return []; 
        const stepVel = this.p.constructor.Vector.div(this.vel, steps).mult(speedMult);
        
        let hitEvents = [];
        const velBeforeSteps = this.vel.copy();

        for (let i = 0; i < steps; i++) {
            this.pos.add(stepVel);
            const collisionEvents = checkBrickCollisions(this);
            hitEvents.push(...collisionEvents);

            if (collisionEvents.length > 0) {
                if (collisionEvents.some(e => e.type === 'brick_hit')) {
                    this.consecutiveWallHits = 0;
                }
                break;
            }
            
            const right = board.x + board.width - board.border/2, bottom = board.y + board.height - board.border/2, left = board.x + board.border/2, top = board.y + board.border/2;
            let wallHit = false;
            let wallNormal = this.p.createVector(0,0);

            if (this.pos.x - this.radius < left) { this.vel.x *= -1; this.pos.x = left + this.radius; wallHit = true; wallNormal.x = 1; }
            else if (this.pos.x + this.radius > right) { this.vel.x *= -1; this.pos.x = right - this.radius; wallHit = true; wallNormal.x = -1; }

            if (this.pos.y - this.radius < top) { this.vel.y *= -1; this.pos.y = top + this.radius; wallHit = true; wallNormal.y = 1; }
            else if (this.pos.y + this.radius > bottom) { this.vel.y *= -1; this.pos.y = bottom - this.radius; wallHit = true; wallNormal.y = -1; }

            if (wallHit) {
                if (this.lastWallHitFrame !== this.p.frameCount) {
                    this.consecutiveWallHits++;
                    if (this.lastWallHitFrame > 0) this.previousWallHitFrame = this.lastWallHitFrame;
                    this.lastWallHitFrame = this.p.frameCount;
                }
                event.dispatch('MiniBallHitWall', { miniBall: this, velBefore: velBeforeSteps, wallNormal: wallNormal.normalize() });
                
                if (this.isDying) {
                    this.handleDeath(board, hitEvents);
                    break;
                }

                const damage = BALL_STATS.types.miniball.wallHitDamage;
                const dmgEvent = this.takeDamage(damage, 'miniball_wall');
                hitEvents.push(dmgEvent);
                break;
            }
        }
        return hitEvents;
    }

    draw() { 
        this.p.fill(127, 255, 212); 
        this.p.noStroke(); 
        this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2); 
    }
}

export class Ball { 
    constructor(p, x, y, type, gridUnitSize, stats, { isGhost = false, lifetimeInSeconds = 1, instanceId = null } = {}) { 
        this.p = p;
        this.pos = p.createVector(x, y); 
        this.vel = p.createVector(0, 0); 
        this.isMoving = false; 
        
        this.gridUnitSize = gridUnitSize;
        this.stats = stats;
        this.type = type;
        this.instanceId = instanceId;
        
        this.evoTier = BALL_STATS.types[type]?.evoTier || 1;
        this.launchCost = BALL_STATS.types[type]?.launchCost || 0;
        this.growAreaStack = 0; 
        this.powerUpDirectDamageStack = 0; // STACKING BUFF

        this.recalculateStats();

        this.hp = this.maxHp; 
        this.flashTime = 0; 
        this.trail = []; 
        this.angle = 0; 
        this.piercedBricks = new Set();
        this.brickHitCooldowns = new Map();
        this.isDead = false;
        this.isDying = false; 
        this.executionThreshold = 0;
        this.lastHit = { target: 'none', side: 'none' };
        this.overflowApplied = false;
        this.hitHistory = [];
        
        this.autoSplitTimer = 0;
        this.burningCoreTimer = 0;
        this.burningDamageStack = 0;
        this.spinningSpikeTimer = 0;
        this.spinningSpikeAngle = 0;
        this.nullifierCooldown = 0;
        this.clingyTimer = 0;
        this.breadCrumbTimer = 0;
        this.consecutiveWallHits = 0;
        this.lastWallHitFrame = -999;
        this.previousWallHitFrame = -999;
        
        this.phaserTimer = 0; 
        this.gatlingTimer = 0; 
        this.gatlingShotsLeft = 0; 
        this.chaseDamageStack = 0; 
        this.doomTickerTimer = 60; 
        
        this.powerUpUses = this.powerUpMaxUses = BALL_STATS.types[type]?.powerUpUses ?? 0;
        this.isPiercing = false; 
        this.piercingContactsLeft = 0; 
        this.piercedBricks.clear();

        this.isGhost = isGhost;
        if (this.isGhost) {
            this.maxLifetime = lifetimeInSeconds * 60; 
            this.lifetime = this.maxLifetime;
            this.hp = Infinity;
            this.powerUpUses = 0;
            this.trail = []; 
        }
        
        if(type === 'giant') {
            this.damageDealtForHpLoss = 0;
        }
    } 

    getActiveEquipment() {
        if (this.instanceId && state.ballEquipment[this.instanceId]) {
            return state.ballEquipment[this.instanceId].filter(Boolean);
        }
        return getActiveEquipmentForBallType(this.type);
    }

    recalculateStats() {
        const type = this.type;
        const baseStats = BALL_STATS.types[type] || BALL_STATS.types.classic;
        let inventoryItem = null;
        if (this.instanceId) {
            inventoryItem = state.ballInventory.find(b => b.instanceId === this.instanceId);
        }

        let computedStats = { hpMultiplier: 1.0, damageMultiplier: 1.0, bonusChainDamage: 0, bonusPowerUpValue: 0, bonusEnergyShieldDuration: 0, bonusMainBallArmor: 0, bonusPowerUpMineCount: 0, bonusLastPowerUpBulletCount: 0, bonusHomingExplosionDamage: 0 };
        if (inventoryItem?.outcomes) {
            inventoryItem.outcomes.forEach(key => {
                const outcomeDef = ENCHANTMENT_OUTCOMES[type][key];
                if (outcomeDef) outcomeDef.apply(computedStats);
            });
        }

        const equipment = this.getActiveEquipment();
        let baseHp = (baseStats.hp ?? 100) * computedStats.hpMultiplier;
        
        if (type !== 'giant') {
            baseHp += (state.upgradeableStats.extraBallHp ?? 0);
        } else {
            // Giant uses specifically tuned HP from skill tree
            baseHp = state.upgradeableStats.giantHp || 20;
        }

        const trashBin = equipment.find(e => e.id === 'trash_bin');
        if (trashBin) baseHp = trashBin.config.setHp;
        
        const berserker = equipment.find(e => e.id === 'berserker');
        if (berserker) baseHp = Math.floor(baseHp * berserker.config.hpMult);

        this.maxHp = baseHp;
        if (this.hp === undefined) this.hp = this.maxHp;
        else this.hp = Math.min(this.hp, this.maxHp);

        this.damageMultiplier = computedStats.damageMultiplier; 
        this.bonusChainDamage = computedStats.bonusChainDamage + (baseStats.innateChainDamage || 0); 
        this.bonusEnergyShieldDuration = computedStats.bonusEnergyShieldDuration;
        this.bonusMainBallArmor = computedStats.bonusMainBallArmor + (baseStats.innateArmor || 0); 
        this.bonusPowerUpMineCount = computedStats.bonusPowerUpMineCount;
        this.bonusLastPowerUpBulletCount = computedStats.bonusLastPowerUpBulletCount;
        this.bonusHomingExplosionDamage = computedStats.bonusHomingExplosionDamage;
        this.bonusPowerUpValue = computedStats.bonusPowerUpValue; 
        
        if (berserker) this.bonusChainDamage += berserker.value;
        
        const doomTicker = equipment.find(e => e.id === 'doom_ticker');
        if (doomTicker) { this.doomTickerDamage = doomTicker.config.baseDamage; this.doomTickerTimer = 60; }
        else this.doomTickerDamage = 0;
        
        let baseRadiusMult = (baseStats.radiusMultiplier ?? 0.32);
        let areaAdd = 0;
        const enlargement = equipment.find(e => e.id === 'enlargement');
        if (enlargement) areaAdd += enlargement.value.add; 
        if (this.growAreaStack > 0) areaAdd += this.growAreaStack;
        
        const areaFactor = 1.0 + areaAdd;
        this.radius = this.gridUnitSize * baseRadiusMult * Math.sqrt(areaFactor);
    }
// ... (omitting rest of Ball methods)
    addHitToHistory() { if (this.isGhost) return; this.hitHistory.push(this.pos.copy()); if (this.hitHistory.length > 7) this.hitHistory.shift(); }
    handleDeath(board, hitEvents) { if (this.isDead) return; this.isDead = true; if (this.doomTickerDamage > 0) { const equipment = this.getActiveEquipment(); const tickerItem = equipment.find(e => e.id === 'doom_ticker'); const radius = tickerItem ? tickerItem.config.radiusTiles : 8; this.p.explode(this.pos.copy(), board.gridUnitSize * radius, this.doomTickerDamage, 'doom_ticker'); } hitEvents.push({ type: 'dying_ball_death', pos: this.pos.copy() }); }
    
    update(board, checkBrickCollisions) { 
        if (this.isGhost) { this.lifetime--; if (this.lifetime <= 0) { this.isDead = true; return []; } }
        if (!this.isMoving) return []; 
        
        const equipment = this.getActiveEquipment();
        const ballStats = BALL_STATS.types[this.type];
        
        if (this.phaserTimer > 0) this.phaserTimer--;

        if (this.gatlingShotsLeft > 0) {
            this.gatlingTimer--;
            if (this.gatlingTimer <= 0) {
                this.gatlingTimer = ballStats.bulletInterval || 4; 
                this.gatlingShotsLeft--;
                const speed = board.gridUnitSize * 0.4;
                let vel = this.vel.copy().normalize().mult(speed);
                if (vel.mag() === 0) vel = this.p.constructor.Vector.random2D().mult(speed);
                const spread = ballStats.bulletSpreadAngle || 0.1;
                vel.rotate(this.p.random(-spread, spread));
                
                // Additive Gatling Bullet Damage (reused bullet damage shop keys where applicable)
                const dmg = (ballStats.bulletDamage || 10) + (state.upgradeBonuses.gatling_powerup_bulletDamage || state.upgradeBonuses.bullet_powerup_bulletDamage || 0);
                
                if (this.p.addProjectiles) {
                     const proj = new Projectile(this.p, this.pos.copy(), vel, dmg);
                     this.p.addProjectiles([proj]);
                }
            }
        }

        const autoSplitter = equipment.find(e => e.id === 'auto_splitter');
        if (autoSplitter) {
            this.autoSplitTimer++;
            if (this.autoSplitTimer >= autoSplitter.value * 60) {
                this.autoSplitTimer = 0;
                const angle = this.p.random(this.p.TWO_PI);
                const speed = this.vel.mag();
                const v = this.p.constructor.Vector.fromAngle(angle).mult(speed);
                this.p.queueAction({ type: 'spawn_clone', ball: { pos: this.pos.copy(), vel: v, type: this.type, instanceId: this.instanceId }, delay: 0 });
            }
        }
        
        const breadCrumbsItem = equipment.find(e => e.id === 'bread_crumbs');
        if (breadCrumbsItem) { this.breadCrumbTimer++; if (this.breadCrumbTimer >= breadCrumbsItem.value * 60) this.breadCrumbTimer = 0; }

        const burningCore = equipment.find(e => e.id === 'burning_core');
        if (burningCore) { this.burningCoreTimer++; if (this.burningCoreTimer >= burningCore.config.tickFrames) { this.burningCoreTimer = 0; this.burningDamageStack += burningCore.value.stack; } }
        
        const spinningSpikes = equipment.find(e => e.id === 'spinning_spikes');
        if (spinningSpikes && !this.isGhost) {
            this.spinningSpikeTimer++;
            if (this.spinningSpikeTimer >= spinningSpikes.value.interval * 60) {
                this.spinningSpikeTimer = 0;
                const angle = (this.p.PI / 4) * this.spinningSpikeAngle;
                this.spinningSpikeAngle = (this.spinningSpikeAngle + 1) % 8;
                const speed = board.gridUnitSize * 0.4;
                const vel = this.p.constructor.Vector.fromAngle(angle).mult(speed);
                const proj = new Projectile(this.p, this.pos.copy(), vel, spinningSpikes.config.damage);
                this.p.addProjectiles([proj]); 
            }
        }
        
        if (this.doomTickerDamage > 0) {
            this.doomTickerTimer--;
            if (this.doomTickerTimer <= 0) {
                this.doomTickerTimer = 60;
                const tickerItem = equipment.find(e => e.id === 'doom_ticker');
                if (tickerItem) this.doomTickerDamage = Math.max(0, this.doomTickerDamage * (1 - tickerItem.value) - tickerItem.config.decayFixed);
            }
        }
        
        if (this.nullifierCooldown > 0) this.nullifierCooldown--;
        if (this.clingyTimer > 0) this.clingyTimer--;
        if (this.flashTime > 0) this.flashTime--;

        for (const [brick, cooldown] of this.brickHitCooldowns.entries()) {
            if (cooldown - 1 <= 0) this.brickHitCooldowns.delete(brick);
            else this.brickHitCooldowns.set(brick, cooldown - 1);
        }
        
        if (!this.isGhost) { this.trail.push(this.pos.copy()); if (this.trail.length > 15) this.trail.shift(); }
        this.angle += 0.05;

        const speed = this.vel.mag();
        const clingyItem = equipment.find(e => e.id === 'clingy');
        const speedMult = this.clingyTimer > 0 ? (clingyItem ? clingyItem.config.speedMult : 0.2) : 1.0;
        const effectiveSpeed = speed * speedMult;
        const steps = Math.ceil(effectiveSpeed / (this.radius * 0.8));
        if (steps <= 0) return [];
        const stepVel = this.p.constructor.Vector.div(this.vel, steps).mult(speedMult);
        let hitEvents = [];
        
        if (this.burningCoreTimer === 0 && burningCore && !this.isGhost && this.type !== 'giant') {
             const dmgEvent = this.takeDamage(burningCore.config.hpLoss, 'burning_core');
             if(dmgEvent) hitEvents.push(dmgEvent);
        }
        
        if (this.breadCrumbTimer === 0 && breadCrumbsItem) hitEvents.push({ type: 'spawn_breadcrumb', pos: this.pos.copy() });

        const velBeforeSteps = this.vel.copy();

        for(let i=0; i<steps; i++) {
            this.pos.add(stepVel);
            const collisionEvents = checkBrickCollisions(this);
            hitEvents.push(...collisionEvents);
            if (collisionEvents.length > 0) { if (collisionEvents.some(e => e.type === 'brick_hit')) this.consecutiveWallHits = 0; break; }

            const right = board.x + board.width - board.border/2, bottom = board.y + board.height - board.border/2, left = board.x + board.border/2, top = board.y + board.border/2;
            let wallHit = false; let wallNormal = this.p.createVector(0,0);
            if (this.pos.x - this.radius < left) { this.vel.x *= -1; this.pos.x = left + this.radius; wallHit = true; wallNormal.x = 1; this.lastHit = { target: 'wall', side: 'left' }; }
            else if (this.pos.x + this.radius > right) { this.vel.x *= -1; this.pos.x = right - this.radius; wallHit = true; wallNormal.x = -1; this.lastHit = { target: 'wall', side: 'right' }; }
            if (this.pos.y - this.radius < top) { this.vel.y *= -1; this.pos.y = top + this.radius; wallHit = true; wallNormal.y = 1; if (!wallNormal.x) this.lastHit = { target: 'wall', side: 'top' }; }
            else if (this.pos.y + this.radius > bottom) { this.vel.y *= -1; this.pos.y = bottom - this.radius; wallHit = true; wallNormal.y = -1; if (!wallNormal.x) this.lastHit = { target: 'wall', side: 'bottom' }; }
            
            if (wallHit) {
                if (this.lastWallHitFrame !== this.p.frameCount) {
                    if (!this.isGhost) this.addHitToHistory();
                    this.consecutiveWallHits++;
                    if (this.lastWallHitFrame > 0) this.previousWallHitFrame = this.lastWallHitFrame;
                    this.lastWallHitFrame = this.p.frameCount;
                }
                this.piercedBricks.clear(); 
                event.dispatch('BallHitWall', { ball: this, wallNormal: wallNormal.normalize(), velBefore: velBeforeSteps });
                if (this.isDying && this.type !== 'giant') { this.handleDeath(board, hitEvents); break; }
                const damageEvent = this.takeDamage(BALL_STATS.types[this.type].wallHitDamage, 'wall', this.pos);
                if (damageEvent) { damageEvent.velBefore = velBeforeSteps; damageEvent.wallNormal = wallNormal.normalize(); hitEvents.push(damageEvent); }
                break;
            }
        }
        return hitEvents;
    }

    takeDamage(amount, source = 'brick', position = this.pos) {
        if (this.isGhost) return null; 
        if (source === 'brick' && (this.isPiercing || (this.type === 'phaser' && this.phaserTimer > 0))) return null;
        if (this.type === 'giant' && source !== 'wall' && source !== 'giant_power') return null;

        let finalDamage = amount;
        if (this.bonusMainBallArmor > 0) finalDamage = Math.max(0, amount - this.bonusMainBallArmor);
        if (this.type === 'giant') this.hp -= finalDamage;
        
        return { type: 'damage_taken', source, ballType: this.type, damageAmount: finalDamage, position: position.copy() };
    }

    usePowerUp(board, options = {}) {
        let isPeek = options.isPeek || (typeof options === 'boolean' ? options : false);
        let skipDecrement = options.skipDecrement || isPeek;
        
        if (this.isGhost || (!skipDecrement && this.powerUpUses <= 0) || !this.isMoving) return null;
        if (!skipDecrement) {
            this.powerUpUses--;
            // ADDITIVE STACKING BUFF
            const buffKey = {
                piercing: 'piercing_powerup_directDamage',
                phaser: 'phaser_powerup_directDamage',
                grow: 'grow_powerup_directDamage',
                chase: 'chase_powerup_directDamage'
            }[this.type];
            if (buffKey) this.powerUpDirectDamageStack += (state.upgradeBonuses[buffKey] || 0);
        }
        
        let powerUpResult = { vfx: [{type: 'powerup', heart: this.pos.copy(), pos: this.pos.copy()}] };
        const ballTypeStats = BALL_STATS.types[this.type];

        switch(this.type) {
            case 'explosive': 
            case 'draining':
            case 'spray':
            {
                let enchRadius = this.bonusPowerUpValue || 0;
                powerUpResult.effect = { type: 'explode', pos: this.pos.copy(), radius: this.gridUnitSize * (ballTypeStats.radiusTiles + enchRadius) };
                break;
            }
            case 'piercing':
            case 'grow':
                if (!isPeek) {
                    this.isPiercing = true; this.piercingContactsLeft = ballTypeStats.contactCount; this.piercedBricks.clear();
                    if (this.type === 'grow') { this.growAreaStack += ballTypeStats.growAmount; this.recalculateStats(); }
                    if (this.bonusEnergyShieldDuration > 0) state.invulnerabilityTimer = Math.max(state.invulnerabilityTimer, this.bonusEnergyShieldDuration * 60);
                }
                powerUpResult.sound = 'piercingActivate';
                break;
            case 'phaser': if (!isPeek) this.phaserTimer = ballTypeStats.phaseDuration * 60; powerUpResult.sound = 'piercingActivate'; break;
            case 'split':
            case 'cluster':
                const miniballs = []; const count = ballTypeStats.miniBallCount; const angleSpread = 40; 
                for(let i=0; i<count; i++) {
                    const angle = this.p.map(i, 0, count > 1 ? count - 1 : 1, -angleSpread / 2, angleSpread / 2);
                    let v = this.vel.copy().rotate(this.p.radians(angle));
                    miniballs.push(new MiniBall(this.p, this.pos.x, this.pos.y, v, this.gridUnitSize, this.type, this.instanceId));
                }
                powerUpResult.effect = { type: 'spawn_miniballs', miniballs }; powerUpResult.sound = 'split'; break;
            case 'brick':
                powerUpResult.effect = { type: 'spawn_bricks', center: this.pos.copy(), coinChance: state.upgradeableStats.brickSummonCoinChance, bonusMines: (this.bonusPowerUpMineCount || 0) };
                powerUpResult.sound = 'brickSpawn'; break;
            case 'cross':
                powerUpResult.effect = { type: 'spawn_cross_bricks', center: this.pos.copy(), coinChance: (state.upgradeBonuses.cross_special_coinChance / 100 || 0.2), bonusMines: (this.bonusPowerUpMineCount || 0) };
                powerUpResult.sound = 'brickSpawn'; break;
            case 'hollow':
                powerUpResult.effect = { type: 'hollow_push', center: this.pos.copy(), radiusTiles: ballTypeStats.spawnRadiusTiles, coinChance: (state.upgradeBonuses.hollow_special_coinChance / 100 || 0.2), bonusMines: (this.bonusPowerUpMineCount || 0) };
                powerUpResult.sound = 'brickSpawn'; break;
            case 'bullet': 
            case 'octo':
            case 'gatling':
            {
                const speed = this.gridUnitSize * ballTypeStats.speedMultiplier;
                let damage = ballTypeStats.bulletDamage || 40;
                const bonusKey = { bullet: 'bullet_powerup_bulletDamage', octo: 'octo_powerup_bulletDamage', gatling: 'bullet_powerup_bulletDamage' }[this.type];
                damage += (state.upgradeBonuses[bonusKey] || 0);

                const gridC = Math.round((this.pos.x - board.genX) / this.gridUnitSize);
                const gridR = Math.round((this.pos.y - board.genY) / this.gridUnitSize);
                const spawnPos = this.p.createVector(board.genX + gridC * this.gridUnitSize + this.gridUnitSize / 2, board.genY + gridR * this.gridUnitSize + this.gridUnitSize / 2);
                
                if (this.type === 'gatling') {
                    if (!isPeek) {
                        let count = ballTypeStats.bulletCountOnPowerup || 6;
                        count += (state.upgradeBonuses.gatling_powerup_bulletCount || 0);
                        this.gatlingShotsLeft = count; this.gatlingTimer = 0; 
                    }
                    powerUpResult.sound = 'bulletFire';
                } else {
                    let directions = [ {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0} ];
                    if (this.type === 'octo') { const diag = 0.707; directions.push({x:diag, y:diag}, {x:-diag, y:diag}, {x:diag, y:-diag}, {x:-diag, y:-diag}); }
                    const newProjectiles = directions.map(d => new Projectile(this.p, spawnPos.copy(), this.p.createVector(d.x, d.y).mult(speed), damage));
                    if (this.powerUpUses === 0 && this.bonusLastPowerUpBulletCount > 0) {
                        for (let i = 0; i < this.bonusLastPowerUpBulletCount; i++) {
                            const newVel = this.p.constructor.Vector.fromAngle((this.p.PI/2)*i + (this.p.PI/4)).mult(speed);
                            newProjectiles.push(new Projectile(this.p, spawnPos.copy(), newVel, damage));
                        }
                    }
                    powerUpResult.effect = { type: 'spawn_projectiles', projectiles: newProjectiles }; powerUpResult.sound = 'bulletFire';
                }
                break;
            }
            case 'homing':
            case 'chase':
            case 'seeker':
                if (this.type === 'chase') {
                    if (!isPeek) {
                        const bricks = this.p.getBricks(); const board = this.p.getBoard(); let target = null; let minDistSq = Infinity;
                         for(let c=0; c<board.cols; c++) for(let r=0; r<board.rows; r++) {
                            const b = bricks[c][r];
                            if (b && b.type === 'goal') {
                                const bp = b.getPixelPos(board); const center = {x: bp.x + b.size/2, y: bp.y + b.size/2};
                                const dSq = (this.pos.x - center.x)**2 + (this.pos.y - center.y)**2;
                                if (dSq < minDistSq) { minDistSq = dSq; target = center; }
                            }
                        }
                        if (target) { const speed = this.vel.mag(); this.vel = this.p.constructor.Vector.sub(this.p.createVector(target.x, target.y), this.pos).normalize().mult(speed); }
                    }
                    powerUpResult.sound = 'homingLaunch';
                } else { powerUpResult.effect = { type: 'spawn_homing_projectile' }; powerUpResult.sound = 'homingLaunch'; }
                break;
        }
        return powerUpResult;
    }

    draw(buffer, combo = 0, board) {
         buffer = buffer || this.p;

        if (this.isGhost) {
            const fadeDuration = 0.25 * 60; 
            let alpha = 100; 
            if (this.lifetime < fadeDuration) {
                alpha = buffer.map(this.lifetime, 0, fadeDuration, 0, 100);
            }
            buffer.noStroke();
            buffer.fill(0, 255, 127, alpha);
            buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2);
            return;
        }

        const ballColor = buffer.color(0, 255, 127);
        const yellowTint = buffer.color(255, 230, 0); 
        
        this.trail.forEach((t, i) => { const alpha = buffer.map(i, 0, this.trail.length, 0, 80); buffer.fill(ballColor.levels[0], ballColor.levels[1], ballColor.levels[2], alpha); buffer.noStroke(); buffer.ellipse(t.x, t.y, this.radius * 2 * (i/this.trail.length)); });
        buffer.noStroke();
        
        let mainFillColor;

        if (this.type === 'giant') { 
            const c1 = buffer.color(148, 0, 211); 
            const c2 = buffer.color(75, 0, 130); 
            mainFillColor = buffer.lerpColor(c1, c2, buffer.sin(buffer.frameCount * 0.1)); 
        } else { 
            if (['strong', 'lightning', 'cluster', 'cell', 'draining', 'spray', 'phaser', 'grow', 'cross', 'hollow', 'octo', 'gatling', 'seeker', 'chase'].includes(this.type)) {
                mainFillColor = buffer.lerpColor(ballColor, yellowTint, 0.4); 
            } else {
                mainFillColor = (this.flashTime > 0 ? buffer.color(255) : ballColor); 
            }
        }

        const noPowerUps = this.powerUpUses <= 0;
        
        if (this.type !== 'split' && this.type !== 'cluster') {
             drawGlossyCircle(buffer, this.pos, this.radius, mainFillColor);
        }

        switch(this.type) {
            case 'strong':
                buffer.fill(50,150,50,100);
                buffer.noStroke();
                buffer.push();
                buffer.translate(this.pos.x, this.pos.y);
                const spikes = 4;
                buffer.beginShape();
                for (let i = 0; i < spikes * 2; i++) {
                    const angle = (buffer.PI / spikes) * i;
                    const r = (i % 2 === 0) ? this.radius * 1.2 : this.radius * 1.2;                    
                    const x = buffer.cos(angle) * r;
                    const y = buffer.sin(angle) * r;
                    buffer.vertex(x, y);
                }
                buffer.endShape(buffer.CLOSE);
                buffer.pop();
                drawGlossyCircle(buffer, this.pos, this.radius * 1.0, mainFillColor);
                break;

            case 'lightning':
                buffer.push();
                buffer.translate(this.pos.x, this.pos.y);
                buffer.stroke(255, 255, 200);
                buffer.strokeWeight(2);
                buffer.noFill();
                for(let i=0; i<3; i++) {
                    buffer.push();
                    buffer.rotate(buffer.TWO_PI/3 * i);
                    buffer.beginShape();
                    buffer.vertex(0, 0);
                    buffer.vertex(this.radius*0.4, -this.radius*0.3);
                    buffer.vertex(this.radius*0.6, 0);
                    buffer.vertex(this.radius*1.1, -this.radius*0.3);
                    buffer.endShape();
                    buffer.pop();
                }
                buffer.pop();
                break;

            case 'cell':
                for (let i = 5; i > 0; i--) {
                    const glowAlpha = buffer.map(buffer.sin(buffer.frameCount * 0.15), -1, 1, 255, 100);
                    buffer.fill (150, 255, 100, glowAlpha * 0.2);
                    buffer.stroke(200, 255, 200, glowAlpha);
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * (i * 0.4));
                }
                buffer.fill(75, 150, 75);
                buffer.ellipse(this.pos.x, this.pos.y, this.radius * 0.4);
                break;

            case 'explosive': 
                if (!noPowerUps) { 
                    const glowAlpha = buffer.map(buffer.sin(buffer.frameCount * 0.15), -1, 1, 150, 220);
                    buffer.noFill(); buffer.stroke(255, 0, 0, glowAlpha); buffer.strokeWeight(3); buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.3);
                } 
                break;

            case 'draining':
                if (!noPowerUps) {
                    const glowAlpha = buffer.map(buffer.sin(buffer.frameCount * 0.15), -1, 1, 150, 220);
                    buffer.noFill(); buffer.stroke(255, 0, 0, glowAlpha); buffer.strokeWeight(3); buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.3);
                    
                    buffer.fill(255, 0, 0);
                    buffer.noStroke();
                    buffer.push();
                    buffer.translate(this.pos.x, this.pos.y);
                    const spikeCount = 3;
                    for(let i=0; i<spikeCount; i++) {
                        buffer.rotate(buffer.TWO_PI/spikeCount);
                        buffer.stroke(255,0,0,100);
                        buffer.strokeWeight(2);
                        buffer.line(this.radius, 0, this.radius*0.2, 0);
                        buffer.line(this.radius*0.7, this.radius*0.4, this.radius*0.4, 0);
                    }
                    buffer.pop();
                }
                break;

            case 'spray':
                if (!noPowerUps) {
                    const glowAlpha = buffer.map(buffer.sin(buffer.frameCount * 0.15), -1, 1, 150, 220);
                    buffer.noFill(); buffer.stroke(255, 0, 0, glowAlpha); buffer.strokeWeight(3); buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.3);

                    buffer.noStroke();
                    const centerGlow = buffer.drawingContext.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, this.radius);
                    centerGlow.addColorStop(0, 'rgba(50, 100, 50, 0.2)');
                    centerGlow.addColorStop(1, 'rgba(50, 100, 50, 1)');
                    buffer.drawingContext.fillStyle = centerGlow;
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius*1.4);
                }
                break;

            case 'piercing': 
                if (!noPowerUps) { 
                    buffer.stroke(200); buffer.strokeWeight(1.5); 
                    if (buffer.drawingContext) buffer.drawingContext.setLineDash([3, 3]); buffer.noFill(); buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.2); if (buffer.drawingContext) buffer.drawingContext.setLineDash([]); 
                } 
                if(this.isPiercing) { 
                    const glowSize = buffer.map(buffer.sin(buffer.frameCount * 0.2), -1, 1, 2.5, 3.0); 
                    const color = buffer.color(255, 255, 255, 80);
                    buffer.fill(color); buffer.noStroke(); buffer.ellipse(this.pos.x, this.pos.y, this.radius * glowSize); 
                    buffer.fill(color.levels[0], color.levels[1], color.levels[2], 120); buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.2); 
                } 
                break;

            case 'phaser':
                buffer.noFill();
                buffer.stroke(100, 255, 255);
                buffer.strokeWeight(2);
                buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2);
                
                buffer.stroke(100, 255, 255, 150);
                let shift = buffer.sin(buffer.frameCount * 0.2) * 3;
                buffer.ellipse(this.pos.x + shift, this.pos.y, this.radius * 1.4);
                
                buffer.stroke(255, 255, 255, 100);
                buffer.strokeWeight(1.5);
                for(let y = -this.radius; y < this.radius; y+=4) {
                    buffer.line(this.pos.x - this.radius, this.pos.y + y, this.pos.x + this.radius, this.pos.y + y);
                }
                break;

            case 'grow':
                buffer.fill(150, 255, 150); 
                buffer.noStroke();
                buffer.ellipse(this.pos.x, this.pos.y, this.radius * 1.5); 
                
                buffer.noFill();
                buffer.stroke(100, 255, 100, 150);
                buffer.strokeWeight(4);
                buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.2);
                
                if (!noPowerUps) {
                     buffer.stroke(200); buffer.strokeWeight(1.5); 
                     if (buffer.drawingContext) buffer.drawingContext.setLineDash([3, 3]); buffer.noFill(); buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.5); if (buffer.drawingContext) buffer.drawingContext.setLineDash([]); 
                }
                break;

            case 'split': 
            case 'cluster':
                if (!noPowerUps) {
                    buffer.push(); buffer.translate(this.pos.x, this.pos.y); buffer.rotate(this.angle); 
                    const numSubBalls = this.type === 'cluster' ? 5 : 3;
                    const subBallSize = this.radius * (this.type === 'cluster' ? 0.45 : 0.55);
                    const orbitRadius = this.radius * 0.6;
                    for (let i = 0; i < numSubBalls; i++) { 
                        const a = buffer.TWO_PI/numSubBalls * i; const x = buffer.cos(a) * orbitRadius; const y = buffer.sin(a) * orbitRadius;
                        drawGlossyCircle(buffer, {x, y}, subBallSize, mainFillColor);
                    } 
                    buffer.pop(); 
                }
                break;

            case 'brick': 
                if (!noPowerUps) {
                    buffer.push(); buffer.translate(this.pos.x, this.pos.y); buffer.rotate(this.angle);
                    const legDist = this.radius * 0.8; const legSize = this.radius * 0.4;
                    const brickColor = buffer.color(100, 150, 255);
                    const brickShadowColor = buffer.lerpColor(brickColor, buffer.color(0), 0.4);
                    for (let i = 0; i < 4; i++) {
                        const angle = buffer.PI / 4 + i * buffer.PI / 2; const x = buffer.cos(angle) * legDist; const y = buffer.sin(angle) * legDist;
                        buffer.fill(brickShadowColor); buffer.noStroke(); buffer.rect(x - legSize/2, y - legSize/2 + 1, legSize, legSize, 1);
                        buffer.fill(brickColor); buffer.rect(x - legSize/2, y - legSize/2, legSize, legSize, 1);
                    }
                    buffer.pop();
                }
                break;

            case 'cross':
                if (!noPowerUps) {
                    buffer.push(); buffer.translate(this.pos.x, this.pos.y); buffer.rotate(this.angle);
                    const legDist = this.radius * 0.9; const legSize = this.radius * 0.4;
                    const brickColor = buffer.color(100, 150, 255);
                    const brickShadowColor = buffer.lerpColor(brickColor, buffer.color(0), 0.4);
                    for (let i = 0; i < 4; i++) {
                        const angle = i * buffer.PI / 2; 
                        const x = buffer.cos(angle) * legDist; const y = buffer.sin(angle) * legDist;
                        buffer.fill(brickShadowColor); buffer.noStroke(); buffer.rect(x - legSize/2, y - legSize/2 + 1, legSize, legSize, 1);
                        buffer.fill(brickColor); buffer.rect(x - legSize/2, y - legSize/2, legSize, legSize, 1);
                    }
                    buffer.pop();
                }
                break;

            case 'hollow':
                if (!noPowerUps) {
                    buffer.push(); buffer.translate(this.pos.x, this.pos.y); buffer.rotate(this.angle);
                    const legDist = this.radius * 0.8; const legSize = this.radius * 0.4;
                    const brickColor = buffer.color(100, 150, 255);
                    const brickShadowColor = buffer.lerpColor(brickColor, buffer.color(0), 0.4);
                    for (let i = 0; i < 4; i++) {
                        const angle = buffer.PI / 4 + i * buffer.PI / 2; const x = buffer.cos(angle) * legDist; const y = buffer.sin(angle) * legDist;
                        buffer.fill(brickShadowColor); buffer.noStroke(); buffer.rect(x - legSize/2, y - legSize/2 + 1, legSize, legSize, 1);
                        buffer.fill(brickColor); buffer.rect(x - legSize/2, y - legSize/2, legSize, legSize, 1);
                    }
                    buffer.pop();
                    
                    buffer.noStroke();
                    const centerGlow = buffer.drawingContext.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, this.radius);
                    centerGlow.addColorStop(0, 'rgba(50, 100, 50, 0.2)');
                    centerGlow.addColorStop(1, 'rgba(50, 100, 50, 1)');
                    buffer.drawingContext.fillStyle = centerGlow;
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius*1.4);
                }
                break;

            case 'bullet': 
            case 'octo': 
                if (!noPowerUps) {
                    buffer.push(); buffer.translate(this.pos.x, this.pos.y); buffer.noStroke(); buffer.fill(0, 150);
                    const drawGun = (angle) => { buffer.push(); buffer.rotate(angle); const ellipseW = this.radius * 0.5; const ellipseH = this.radius * 0.2; const offset = this.radius * 0.8; buffer.ellipse(0, -offset, ellipseW, ellipseH); buffer.pop(); };
                    drawGun(0); drawGun(buffer.PI); drawGun(buffer.HALF_PI); drawGun(-buffer.HALF_PI);
                    if (this.type === 'octo') { const diag = buffer.PI / 4; drawGun(diag); drawGun(diag + buffer.HALF_PI); drawGun(diag + buffer.PI); drawGun(diag - buffer.HALF_PI); }
                    buffer.pop();
                }
                break;

            case 'gatling':
                if (!noPowerUps) {
                    buffer.push(); 
                    buffer.translate(this.pos.x, this.pos.y); 
                    const dir = this.vel.heading();
                    buffer.rotate(dir);
                    buffer.translate(this.radius * 0.3, 0); 
                    const spin = buffer.frameCount * 0.02; 
                    buffer.rotate(spin);
                    buffer.noStroke(); buffer.fill(0, 150);
                    const barrelCount = 6;
                    for(let i=0; i<barrelCount; i++) { 
                        const a = buffer.TWO_PI/barrelCount * i; 
                        const bx = buffer.cos(a) * this.radius * 0.4; 
                        const by = buffer.sin(a) * this.radius * 0.4; 
                        buffer.ellipse(bx, by, this.radius * 0.4); 
                    }
                    buffer.pop();
                }
                break;

            case 'homing': 
                if (!noPowerUps) { 
                    buffer.noFill(); 
                    buffer.stroke(255, 100, 0); 
                    buffer.strokeWeight(2); 
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * 1.5); 
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * 0.8); 
                } 
                break;

            case 'seeker':
                        buffer.push();
                buffer.translate(this.pos.x, this.pos.y);
                buffer.noFill();
                buffer.stroke(255, 100, 0);
                buffer.strokeWeight(1.5);
                buffer.ellipse(this.radius * -0.4, this.radius * -0.4, this.radius * 0.4);
                buffer.ellipse(this.radius * 0.4, this.radius * -0.1, this.radius * 0.6);
                buffer.ellipse(this.radius * 0.1, this.radius * -0.6, this.radius * 0.3);
                buffer.ellipse(this.radius * -0.4, this.radius * 0.3, this.radius * 0.5);
                buffer.ellipse(this.radius * 0.2, this.radius * 0.5, this.radius * 0.3);
                buffer.pop();
                break;

            case 'chase':
                buffer.push();
                buffer.translate(this.pos.x, this.pos.y);
                let targetAngle = buffer.frameCount * 0.05; 
                if (board) {
                    const bricks = this.p.getBricks ? this.p.getBricks() : [];
                    let minDistSq = Infinity;
                    let target = null;
                    if (bricks && bricks.length > 0) {
                        for(let c=0; c<board.cols; c++) for(let r=0; r<board.rows; r++) {
                            const b = bricks[c][r];
                            if (b && b.type === 'goal') {
                                const bp = b.getPixelPos(board);
                                const cx = bp.x + b.size/2;
                                const cy = bp.y + b.size/2;
                                const dSq = (this.pos.x - cx)**2 + (this.pos.y - cy)**2;
                                if (dSq < minDistSq) {
                                    minDistSq = dSq;
                                    target = {x: cx, y: cy};
                                }
                            }
                        }
                    }
                    if (target) {
                        targetAngle = Math.atan2(target.y - this.pos.y, target.x - this.pos.x);
                    }
                }
                buffer.rotate(targetAngle);
                buffer.fill(0, 100, 0, 150); 
                buffer.noStroke();
                buffer.beginShape();
                buffer.vertex(this.radius * 0.8, 0);
                buffer.vertex(-this.radius * 0.5, -this.radius * 0.5);
                buffer.vertex(-this.radius * 0.2, 0);
                buffer.vertex(-this.radius * 0.5, this.radius * 0.5);
                buffer.endShape(buffer.CLOSE);
                buffer.pop();
                break;
        }
        
        const equipment = this.getActiveEquipment();
        
        const phaser = equipment.find(item => item.id === 'phaser');
        if (phaser && state.phaserCharges > 0) {
            const orbitRadius = this.radius * 1.3; const angle = buffer.frameCount * 0.1; const x = this.pos.x + orbitRadius * buffer.cos(angle); const y = this.pos.y + orbitRadius * buffer.sin(angle);
            buffer.fill(255, 255, 255, 200); buffer.noStroke(); buffer.ellipse(x, y, 6, 6);
        }
        
        if (this.burningDamageStack > 0) {
            buffer.noStroke(); buffer.fill(255, 100, 0, 150); const size = Math.min(10, 2 + this.burningDamageStack * 0.1); buffer.ellipse(this.pos.x + buffer.random(-this.radius, this.radius), this.pos.y + buffer.random(-this.radius, this.radius), size);
        }
        
        if (state.overchargeParticles.length > 0 || state.comboParticles.length > 0) {
            buffer.noStroke(); buffer.fill(255, 255, 0, 150); 
            state.overchargeParticles.forEach(p => { buffer.ellipse(this.pos.x + p.offset.x, this.pos.y + p.offset.y, 4); });
            state.comboParticles.forEach(p => { buffer.ellipse(this.pos.x + p.offset.x, this.pos.y + p.offset.y, 4); });
        }

        if (state.isDebugView && !this.isGhost) {
            let damage = calculateBallDamage(this, combo, state);
            damage = Math.max(1, Math.floor(damage));
            const cX = this.pos.x; const cY = this.pos.y;
            buffer.textAlign(buffer.CENTER, buffer.CENTER); const textSize = this.radius; buffer.textSize(textSize); buffer.noStroke();
            const damageText = `${damage}`; let panelWidth = buffer.textWidth(damageText) + 4; let panelHeight = textSize + 4;
            buffer.fill(0, 0, 0, 150); buffer.rect(cX - panelWidth / 2, cY - panelHeight / 2, panelWidth, panelHeight, 2);
            buffer.fill(255, 165, 0); buffer.text(damageText, cX, cY);
        }
    } 
}

export function createBallVisuals(p) {
    const size = 40; const types = ['classic', 'explosive', 'piercing', 'split', 'brick', 'bullet', 'homing', 'giant', 'strong', 'lightning', 'cluster', 'cell', 'draining', 'spray', 'phaser', 'grow', 'cross', 'hollow', 'octo', 'gatling', 'seeker', 'chase'];
    const visuals = {}; const dummyStats = { ballMaxHp: BALL_STATS.types.classic.hp };
    types.forEach(type => { const pg = p.createGraphics(size, size); pg.clear(); const temp = new Ball(p, size / 2, size / 2, type, 20, dummyStats); temp.radius = size * 0.4; temp.draw(pg); visuals[type] = pg.canvas.toDataURL(); pg.remove(); });
    return visuals;
}