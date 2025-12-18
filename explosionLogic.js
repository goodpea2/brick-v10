
// explosionLogic.js
import { Shockwave, Particle, StripeFlash } from './vfx.js';
import { sounds } from './sfx.js';
import { state } from './state.js';
import { BRICK_STATS, BALL_STATS } from './balancing.js';

export function explode(p, pos, radius, damage, source = 'ball', context) {
    const { board, bricks, shockwaves, particles, delayedActionsQueue, ballsInPlay, triggerShake } = context;

    let finalDamage = damage;
    const activeBallType = ballsInPlay.length > 0 ? ballsInPlay[0].type : state.selectedBallType;

    if (source === 'ball') {
        const bonusKey = {
            explosive: 'explosive_powerup_explosionDamage',
            draining: 'draining_powerup_explosionDamage',
            spray: 'spray_powerup_explosionDamage'
        }[activeBallType];

        if (activeBallType === 'draining') {
            const pct = Math.max(0, Math.min(1, (context.sharedBallStats?.hp || 0) / (context.sharedBallStats?.maxHp || 100)));
            const s = BALL_STATS.types.draining;
            finalDamage = s.explosiveDamageMin + (1 - pct) * (s.explosiveDamageMax - s.explosiveDamageMin);
        } else {
            finalDamage = (BALL_STATS.types[activeBallType]?.damage || BALL_STATS.types[activeBallType]?.explosionDamage || 10);
        }
        
        if (bonusKey) finalDamage += (state.upgradeBonuses[bonusKey] || 0);
    }

    const equipment = state.ballEquipment[activeBallType]?.filter(Boolean) || [];
    const blastAmp = equipment.find(item => item.id === 'explosion_radius');
    if (blastAmp) { finalDamage *= blastAmp.value.damageMult; radius += blastAmp.value.radiusBonusTiles * board.gridUnitSize; }
    const gasTech = equipment.find(item => item.id === 'gas_tech');
    if (gasTech) finalDamage *= gasTech.value.explosion;
    
    const deconstructor = equipment.find(item => item.id === 'deconstructor');
    const isHealing = !!deconstructor;
    const color = isHealing ? p.color(0, 255, 127) : p.color(255, 100, 0);
    
    shockwaves.push(new Shockwave(p, pos.x, pos.y, radius - (board.gridUnitSize * 0.25), color, 15));
    for (let i = 0; i < 50; i++) particles.push(new Particle(p, pos.x, pos.y, color, p.random(5, 15), { lifespan: 60, size: p.random(3, 6) }));
    sounds.explosion(); triggerShake(4, 12);

    const hitBricks = new Set();
    const minC = Math.max(0, Math.floor((pos.x - radius - board.genX) / board.gridUnitSize));
    const maxC = Math.min(board.cols - 1, Math.floor((pos.x + radius - board.genX) / board.gridUnitSize));
    const minR = Math.max(0, Math.floor((pos.y - radius - board.genY) / board.gridUnitSize));
    const maxR = Math.min(board.rows - 1, Math.floor((pos.y + radius - board.genY) / board.gridUnitSize));

    for (let c = minC; c <= maxC; c++) {
        for (let r = minR; r <= maxR; r++) {
            const brick = bricks[c][r];
            if (brick && !hitBricks.has(brick)) {
                const brickPos = brick.getPixelPos(board);
                const w = brick.size * brick.widthInCells; const h = brick.size * brick.heightInCells;
                let tx = pos.x, ty = pos.y;
                if (pos.x < brickPos.x) tx = brickPos.x; else if (pos.x > brickPos.x + w) tx = brickPos.x + w;
                if (pos.y < brickPos.y) ty = brickPos.y; else if (pos.y > brickPos.y + h) ty = brickPos.y + h;
                if ((pos.x - tx)**2 + (pos.y - ty)**2 <= radius * radius) hitBricks.add(brick);
            }
        }
    }
    
    hitBricks.forEach(brick => {
        if (isHealing) {
            brick.heal(finalDamage);
            particles.push(new Particle(p, brick.getPixelPos(board).x + brick.size/2, brick.getPixelPos(board).y + brick.size/2, p.color(100, 255, 100), 2, {lifespan: 40}));
        } else {
            const bPos = brick.getPixelPos(board); const dist = p.dist(pos.x, pos.y, bPos.x + (brick.size * brick.widthInCells) / 2, bPos.y + (brick.size * brick.heightInCells) / 2);
            delayedActionsQueue.push({ type: 'damage', brick: brick, damage: finalDamage, source, delay: Math.floor(dist / (board.gridUnitSize * 0.5)) });
        }
    });
}

export function clearStripe(p, brick, direction, context) {
    const { board, bricks, stripeFlashes, particles, delayedActionsQueue } = context;
    sounds.stripeClear(); stripeFlashes.push(new StripeFlash(p, brick, direction, board));
    const brickPos = brick.getPixelPos(board); const brickCenter = p.createVector(brickPos.x + brick.size / 2, brickPos.y + brick.size / 2);
    for (let i = 0; i < 150; i++) {
        const vel = (direction === 'horizontal') ? p.createVector((i % 2 === 0 ? 1 : -1) * p.random(25, 35), p.random(-2, 2)) : p.createVector(p.random(-2, 2), (i % 2 === 0 ? 1 : -1) * p.random(25, 35));
        particles.push(new Particle(p, brickCenter.x + (direction === 'vertical' ? p.random(-brick.size/2, brick.size/2) : 0), brickCenter.y + (direction === 'horizontal' ? p.random(-brick.size/2, brick.size/2) : 0), p.color(255, 200, 150), 1, { vel, size: p.random(6, 10), lifespan: 60 }));
    }
    const gridC = brick.c + 6; const gridR = brick.r + 6; const bricksToHit = [];
    if (direction === 'horizontal') { for (let c = 0; c < board.cols; c++) if (bricks[c][gridR]) bricksToHit.push(bricks[c][gridR]); }
    else { for (let r = 0; r < board.rows; r++) if (bricks[gridC][r]) bricksToHit.push(bricks[gridC][r]); }
    bricksToHit.forEach(b => {
        const bPos = b.getPixelPos(board); const cPos = p.createVector(bPos.x + (b.size * b.widthInCells) / 2, bPos.y + (b.size * b.heightInCells) / 2);
        const dist = (direction === 'horizontal') ? Math.abs(brickCenter.x - cPos.x) : Math.abs(brickCenter.y - cPos.y);
        delayedActionsQueue.push({ type: 'damage', brick: b, damage: state.upgradeableStats.explosiveBrickDamage, source: 'chain-reaction', delay: Math.floor(dist / (board.gridUnitSize * 0.5)) });
    });
}
