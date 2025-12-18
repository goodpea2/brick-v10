
// equipment.js
import { EQUIPMENT_TEXT } from './text.js';
import { state } from './state.js';
import { EQUIPMENT_RARITY_WEIGHTS } from './balancing.js';

export const RARITIES = {
    COMMON: 'Common',
    RARE: 'Rare',
    EPIC: 'Epic'
};

const EQUIPMENT_DATA = {
// ... (omitting EQUIPMENT_DATA entries as they are identical)
    'direct_damage': {
        icon: '⚔️',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 15, mini: 5 };
                case RARITIES.EPIC: return { main: 20, mini: 6 };
                default: return { main: 10, mini: 4 }; // COMMON
            }
        },
        getEffectText: (value) => `+${value.main} Damage`,
    },
    'healer_leech': {
        icon: '🩸',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 10, applyToMini: true };
                case RARITIES.EPIC: return { main: 14, applyToMini: true };
                default: return { main: 6, applyToMini: true }; // COMMON
            }
        },
        getEffectText: (value) => `+${value.main} HP Leech`,
    },
    'wall_explosion': {
        icon: '💣',
        config: {
            radiusTiles: 1.2,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 15, mini: 8, miniExplodes: false };
                case RARITIES.EPIC: return { main: 20, mini: 10, miniExplodes: false };
                default: return { main: 10, mini: 6, miniExplodes: false }; // COMMON
            }
        },
        getEffectText: (value) => `${value.main} Explosion Damage`,
    },
    'powerup_invulnerability': {
        icon: '🛡️',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 4.5; // seconds
                case RARITIES.EPIC: return 6.0;
                default: return 3.0; // COMMON
            }
        },
        getEffectText: (value) => `${value}s Invulnerability`,
    },
    'combo_damage': {
        icon: '🎉',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 3, mini: 3 };
                case RARITIES.EPIC: return { main: 4, mini: 4 };
                default: return { main: 2, mini: 2 }; // COMMON
            }
        },
        getEffectText: (value) => `+${value.main} Damage per Combo`,
    },
    'explosion_radius': {
        icon: '🔅',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { damageMult: 0.7, radiusBonusTiles: 1.0 };
                case RARITIES.EPIC: return { damageMult: 0.7, radiusBonusTiles: 1.3 };
                default: return { damageMult: 0.7, radiusBonusTiles: 0.6 }; // COMMON
            }
        },
        getEffectText: (value) => `-30% Explosion Dmg, +${value.radiusBonusTiles} Radius`,
    },
    'slow_ball': {
        icon: '🐢',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 0.75; // 25% slower
                case RARITIES.EPIC: return 0.65; // 35% slower
                default: return 0.85; // 15% slower
            }
        },
        getEffectText: (value) => `-${Math.round((1 - value) * 100)}% Ball Speed`,
    },
    'xp_magnet': {
        icon: '🧲',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { radius: 2.25, xp: 1.2, applyToMini: true };
                case RARITIES.EPIC: return { radius: 2.5, xp: 1.3, applyToMini: true };
                default: return { radius: 2.0, xp: 1.1, applyToMini: true };
            }
        },
        getEffectText: (value) => `+${Math.round((value.radius - 1) * 100)}% Magnet Radius, +${Math.round((value.xp - 1) * 100)}% XP Gain`,
    },
    'ramping_damage': {
        icon: '🔋',
        config: {
            tickRate: 15
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 7, mini: 4 };
                case RARITIES.EPIC: return { main: 10, mini: 5 };
                default: return { main: 5, mini: 3 };
            }
        },
        getEffectText: (value, config) => `+${value.main} Damage every ${(config.tickRate / 60).toFixed(2)}s`,
    },
    'wall_bullets': {
        icon: '🔫',
        config: {
            bulletDamage: 5,
            spread: Math.PI / 8
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 3, mini: 1 };
                case RARITIES.EPIC: return { main: 4, mini: 1 };
                default: return { main: 2, mini: 1 };
            }
        },
        getEffectText: (value) => `Spawn ${value.main} bullets on wall hit`,
    },
    'xp_heal': {
        icon: '🩵',
        config: {
            healAmount: 2
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 3;
                case RARITIES.EPIC: return 2;
                default: return 4;
            }
        },
        getEffectText: (value, config) => `Heal ${config.healAmount} HP every ${value} XP Orbs`,
    },
    'executioner': {
        icon: '💀',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 20, applyToMini: false };
                case RARITIES.EPIC: return { main: 30, applyToMini: false };
                default: return { main: 10, applyToMini: false };
            }
        },
        getEffectText: (value) => `Execute bricks under ${value.main} HP.`,
    },
    'damage_reduction': {
        icon: '🧽',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 0.4, applyToMini: true }; // 40%
                case RARITIES.EPIC: return { main: 0.6, applyToMini: true }; // 60%
                default: return { main: 0.2, applyToMini: true }; // 20%
            }
        },
        getEffectText: (value) => `-${Math.round(value.main * 100)}% Damage`,
    },
    'retaliation': {
        icon: '🚀',
        config: {
            projectileRadiusTiles: 0.3,
            projectileDamage: 20,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 40;
                case RARITIES.EPIC: return 30;
                default: return 50;
            }
        },
        getEffectText: (value) => `Spawn a homing missile every ${value} HP lost`,
    },
    'coin_boost': {
        icon: '💰',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 5;
                case RARITIES.EPIC: return 3;
                default: return 8; // COMMON
            }
        },
        getEffectText: (value) => `+1 coin every ${value} collected`,
    },
    'mine_power': {
        icon: '🚨',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 3;
                case RARITIES.EPIC: return 4;
                default: return 2; // COMMON
            }
        },
        getEffectText: (value) => `Spawn ${value} Mines on power-up use`,
    },
    'phaser': {
        icon: '👻',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 4, applyToMini: true };
                case RARITIES.EPIC: return { main: 5, applyToMini: true };
                default: return { main: 3, applyToMini: true }; // COMMON
            }
        },
        getEffectText: (value) => `First ${value.main} brick hits don't bounce`,
    },
    'zap_aura': {
        icon: '⚡',
        config: {
            auraRadiusTiles: 2.2,
            tickRate: 15
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 3, miniRadius: 1.2 };
                case RARITIES.EPIC: return { main: 4, miniRadius: 1.2 };
                default: return { main: 2, miniRadius: 1.2 }; // COMMON
            }
        },
        getEffectText: (value, config) => `${value.main} damage/${(config.tickRate / 60).toFixed(2)}s`,
    },
    'last_stand': {
        icon: '🎁',
        config: {
            bulletDamage: 10,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { bullets: 5, orbs: 6 };
                case RARITIES.EPIC: return { bullets: 6, orbs: 6 };
                default: return { bullets: 4, orbs: 6 }; // COMMON
            }
        },
        getEffectText: (value) => `+${value.bullets} bullets per ${value.orbs} XP Orbs, fired on death`,
    },
    'impact_distributor': {
        icon: '🧱',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { wall: -5, brick: 2, applyToMini: false };
                case RARITIES.EPIC: return { wall: -6, brick: 2, applyToMini: false };
                default: return { wall: -5, brick: 3, applyToMini: false }; // COMMON
            }
        },
        getEffectText: (value) => `${value.wall} wall damage, take ${value.brick} brick damage`,
    },
    'vampire': {
        icon: '❤️‍🩹',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 10, applyToMini: true };
                case RARITIES.EPIC: return { main: 14, applyToMini: true };
                default: return { main: 6, applyToMini: true }; // COMMON
            }
        },
        getEffectText: (value) => `Heal ${value.main} HP per brick broken`,
    },
    'tax_return': {
        icon: '💸',
        config: {
            brickHpBuff: 50,
            brickHpBuffRadiusTiles: 3.5,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 12;
                case RARITIES.EPIC: return 16;
                default: return 8; // COMMON
            }
        },
        getEffectText: (value, config) => `+${value} coins on power-up, +${config.brickHpBuff} HP to nearby bricks`,
    },
    'overflow': {
        icon: '⚜️',
        config: {
            buffingHits: 5,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 20, applyToMini: true };
                case RARITIES.EPIC: return { main: 30, applyToMini: true };
                default: return { main: 10, applyToMini: true }; // COMMON
            }
        },
        getEffectText: (value, config) => `+1 power-up use & +${value.main} HP. First ${config.buffingHits} hits heal bricks.`,
    },
    'enlargement': {
        icon: '🔦',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { add: 0.75, miniAdd: 0.75, applyToMini: true }; // +75% Area
                case RARITIES.EPIC: return { add: 1.0, miniAdd: 1.0, applyToMini: true }; // +100% Area
                default: return { add: 0.5, miniAdd: 0.5, applyToMini: true }; // +50% Area
            }
        },
        getEffectText: (value) => `+${Math.round(value.add * 100)}% Ball Size (Area)`,
    },
    'trash_bin': {
        icon: '🗑️',
        config: {
            setDamage: 1,
            setHp: 10
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { invuln: 8, applyToMini: true };
                case RARITIES.EPIC: return { invuln: 12, applyToMini: true };
                default: return { invuln: 6, applyToMini: true };
            }
        },
        getEffectText: (value, config) => `Forced ${config.setDamage} Damage, ${config.setHp} HP, +${value.invuln}s Invulnerability on launch`,
    },
    'gas_tech': {
        icon: '💨',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { speed: 1.5, explosion: 1.25, applyToMini: true };
                case RARITIES.EPIC: return { speed: 1.5, explosion: 1.35, applyToMini: true };
                default: return { speed: 1.5, explosion: 1.15, applyToMini: true };
            }
        },
        getEffectText: (value) => `+50% Speed, +${Math.round((value.explosion - 1) * 100)}% Explosion Dmg`,
    },
    'berserker': {
        icon: '🌩️',
        config: {
            hpMult: 0.5
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 10;
                case RARITIES.EPIC: return 14;
                default: return 6;
            }
        },
        getEffectText: (value, config) => `+${value} Chain Damage, -${(1 - config.hpMult) * 100}% Max HP`,
    },
    'heal_streak': {
        icon: '🩹',
        config: {
            healAmount: 10
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 15;
                case RARITIES.EPIC: return 10;
                default: return 20;
            }
        },
        getEffectText: (value, config) => `Heal ${config.healAmount} HP every ${value} Combo`,
    },
    'roulette': {
        icon: '🎲',
        config: {
            coinChance: 0.85,
            selfDamageChance: 0.15,
            selfDamage: 50
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 4; // coins
                case RARITIES.EPIC: return 5; // coins
                default: return 3; // coins
            }
        },
        getEffectText: (value) => `85% chance for +${value} Coins, 15% chance to take 50 Dmg`,
    },
    'auto_splitter': {
        icon: '🧫',
        config: {
            miniDamage: 6
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 3; // seconds
                case RARITIES.EPIC: return 2;
                default: return 4;
            }
        },
        getEffectText: (value) => `Spawn a Mini Ball every ${value}s`,
    },
    'burning_core': {
        icon: '❤️‍🔥',
        config: {
            hpLoss: 2,
            tickFrames: 15
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { stack: 6, applyToMini: true, miniStack: 3 };
                case RARITIES.EPIC: return { stack: 8, applyToMini: true, miniStack: 4 };
                default: return { stack: 4, applyToMini: true, miniStack: 2 };
            }
        },
        getEffectText: (value, config) => `Lose ${config.hpLoss} HP/0.25s, gain +${value.stack} Dmg per 0.25s`,
    },
    'spinning_spikes': {
        icon: '🌵',
        config: {
            damage: 5
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { interval: 0.20, applyToMini: true, miniInterval: 0.35 };
                case RARITIES.EPIC: return { interval: 0.15, applyToMini: true, miniInterval: 0.25 };
                default: return { interval: 0.25, applyToMini: true, miniInterval: 0.45 };
            }
        },
        getEffectText: (value) => `Shoot projectile every ${value.interval}s`,
    },
    'doom_ticker': {
        icon: '☢️',
        config: {
            baseDamage: 60,
            radiusTiles: 8,
            decayFixed: 4,
            miniRadiusTiles: 2.5,
            miniBaseDamage: 30
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 0.10;
                case RARITIES.EPIC: return 0.06;
                default: return 0.17;
            }
        },
        getEffectText: (value, config) => `Death Explosion ${config.baseDamage} Dmg. Decays ${Math.round(value*100)}% + ${config.decayFixed} per sec`,
    },
    'nullifier': {
        icon: '📛',
        config: {
            damageBuff: 100
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { cooldown: 0.6, applyToMini: true };
                case RARITIES.EPIC: return { cooldown: 0.4, applyToMini: true };
                default: return { cooldown: 0.8, applyToMini: true };
            }
        },
        getEffectText: (value, config) => `+${config.damageBuff} Dmg, can only hit once per ${value.cooldown}s`,
    },
    'clingy': {
        icon: '💫',
        config: {
            speedMult: 0.2
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { duration: 0.3, applyToMini: true };
                case RARITIES.EPIC: return { duration: 0.4, applyToMini: true };
                default: return { duration: 0.2, applyToMini: true };
            }
        },
        getEffectText: (value, config) => `-${(1 - config.speedMult)*100}% Speed for ${value.duration}s after hit`,
    },
    'bread_crumbs': {
        icon: '🍞',
        config: {
            healAmount: 10
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 4;
                case RARITIES.EPIC: return 3;
                default: return 5;
            }
        },
        getEffectText: (value) => `Drop heal pickup every ${value}s`,
    },
    'aim_assist': {
        icon: '🎯',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 4;
                case RARITIES.EPIC: return 3;
                default: return 5;
            }
        },
        getEffectText: (value) => `Redirect to brick after ${value} wall hits`,
    },
    'corner_camper': {
        icon: '🪅',
        config: {
            bulletDamage: 5,
            spread: Math.PI / 1,
            triggerFrames: 6
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 30, mini: 15 };
                case RARITIES.EPIC: return { main: 40, mini: 20 };
                default: return { main: 20, mini: 10 };
            }
        },
        getEffectText: (value, config) => `Rapid wall hits (<${config.triggerFrames} frames) spawn ${value.main} bullets`,
    },
    'deconstructor': {
        icon: '🛠️',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { main: 30, mini: 8 };
                case RARITIES.EPIC: return { main: 40, mini: 10 };
                default: return { main: 20, mini: 6 };
            }
        },
        getEffectText: (value) => `+${value.main} Dmg, but Explosions heal bricks`,
    },
    'clone_cannon': {
        icon: '🧬',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 2;
                case RARITIES.EPIC: return 3;
                default: return 1;
            }
        },
        getEffectText: (value) => `Launch ${value} clones after firing`,
    },
};

export const ALL_EQUIPMENT_IDS = Object.keys(EQUIPMENT_DATA);

export function createEquipment(id, rarity) {
    const data = EQUIPMENT_DATA[id];
    const textData = EQUIPMENT_TEXT[id];
    if (!data || !textData) return null;

    const value = data.effect(rarity);
    return {
        id,
        rarity,
        name: textData.name,
        description: textData.description,
        icon: data.icon,
        value: value,
        config: data.config,
        effectText: data.getEffectText(value, data.config),
    };
}

export function generateRandomEquipment(ownedEquipmentIds) {
    const availableIds = ALL_EQUIPMENT_IDS.filter(id => !ownedEquipmentIds.includes(id));
    if (availableIds.length === 0) return null;

    const randomId = availableIds[Math.floor(Math.random() * availableIds.length)];

    let rarity;
    
    // Guaranteed Epic first equipment skill logic
    if (state.skillTreeState['guaranteed_epic_first'] && !state.firstEquipmentGained) {
        rarity = RARITIES.EPIC;
        state.firstEquipmentGained = true;
    } else {
        const weights = state.skillTreeState['better_loot_luck'] 
            ? EQUIPMENT_RARITY_WEIGHTS.upgraded 
            : EQUIPMENT_RARITY_WEIGHTS.base;

        const totalWeight = weights.common + weights.rare + weights.epic;
        let r = Math.random() * totalWeight;
        
        if (r < weights.epic) {
            rarity = RARITIES.EPIC;
        } else {
            r -= weights.epic;
            if (r < weights.rare) {
                rarity = RARITIES.RARE;
            } else {
                rarity = RARITIES.COMMON;
            }
        }
        
        // Even if the skill wasn't the trigger, we still flag first gained as true
        state.firstEquipmentGained = true;
    }

    return createEquipment(randomId, rarity);
}
