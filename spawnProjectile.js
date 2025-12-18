
// spawnProjectile.js
import { HomingProjectile, Projectile } from './ball.js';
import { sounds } from './sfx.js';
import { BALL_STATS } from './balancing.js';
import { state } from './state.js';

export function spawnHomingProjectile(p, position, item = null, context) {
    const { board, bricks, projectiles, ballsInPlay, sourceBall } = context;
    if (!position) {
        if (ballsInPlay.length > 0) position = ballsInPlay[0].pos.copy();
        else return;
    }
    
    let targetBrick = null; let min_dist_sq = Infinity;
    for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) { 
        const b = bricks[c][r]; 
        if (b && (b.type === 'goal' || !targetBrick)) { 
            const bp = b.getPixelPos(board), d_sq = p.pow(position.x - (bp.x + b.size / 2), 2) + p.pow(position.y - (bp.y + b.size / 2), 2); 
            if (d_sq < min_dist_sq || (b.type === 'goal' && (!targetBrick || targetBrick.type !== 'goal'))) { min_dist_sq = d_sq; targetBrick = b; } 
        } 
    }
    
    if (targetBrick) {
        let damage = item ? item.config.projectileDamage : BALL_STATS.types.homing.damage;
        const ballForStats = sourceBall || (ballsInPlay.length > 0 ? ballsInPlay[0] : null);
        if (ballForStats?.type === 'homing') damage += ballForStats.bonusHomingExplosionDamage || 0;
        
        let radiusTiles = item ? item.config.projectileRadiusTiles : (ballForStats?.type === 'seeker' ? 0.25 : 1.5);
        const bonusRadius = (item || (ballForStats && !['homing', 'seeker', 'chase'].includes(ballForStats.type))) ? 0 : state.upgradeBonuses.homing_powerup_projectile_explosionRadius;
        
        const radius = board.gridUnitSize * radiusTiles;
        const turnRate = item?.config.turnRate || BALL_STATS.types.homing.turnRate;
            
        const vel = p.constructor.Vector.sub(targetBrick.getPixelPos(board), position).setMag(1);
        projectiles.push(new HomingProjectile(p, position, vel, damage, targetBrick, radius, turnRate, board, bonusRadius));
        sounds.homingLaunch();
    }
}

export function spawnWallBullets(p, position, count, damage, velBefore, wallNormal, context, spread = Math.PI / 8) {
    const { board, projectiles } = context;
    if (!position || !velBefore || !wallNormal) return;
    const d = velBefore.copy().normalize(); const n = wallNormal.copy().normalize(); const dot = d.dot(n);
    const reflection = p.constructor.Vector.sub(d, p.constructor.Vector.mult(n, 2 * dot));
    const baseAngle = reflection.heading();
    const speed = board.gridUnitSize * 0.4;
    for (let i = 0; i < count; i++) {
        const angleOffset = count > 1 ? p.map(i, 0, count - 1, -spread / 2, spread / 2) : 0;
        const finalAngle = baseAngle + angleOffset;
        projectiles.push(new Projectile(p, position.copy(), p.constructor.Vector.fromAngle(finalAngle).mult(speed), damage));
    }
    sounds.bulletFire();
}
