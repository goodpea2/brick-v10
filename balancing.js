
// balancing.js

export const BALL_FAMILIES = {
    Classic: { root: 'classic', children: ['strong', 'lightning'] },
    Split: { root: 'split', children: ['cluster', 'cell'] },
    Explode: { root: 'explosive', children: ['draining', 'spray'] },
    Pierce: { root: 'piercing', children: ['phaser', 'grow'] },
    Brick: { root: 'brick', children: ['cross', 'hollow'] },
    Shooting: { root: 'bullet', children: ['octo', 'gatling'] },
    Homing: { root: 'homing', children: ['seeker', 'chase'] },
    Special: { root: 'giant', children: [] }
};

export const CHARGE_SETTINGS = {
    maxCharge: 500,
    gainPerBrick: {
        1: 16, // Evo 1
        2: 8   // Evo 2
    }
};

export const BALL_STATS = {
    types: {
        classic: {
            evoTier: 1,
            hasDyingState: true,
            launchCost: 0,
            hp: 150,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 0,
            radiusMultiplier: 0.28,
            description: "Has 50 extra HP."
        },
        strong: { // Classic Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 30, 
            powerUpUses: 0,
            radiusMultiplier: 0.28,
            description: "Evo2: Stronger base damage and HP."
        },
        lightning: { // Classic Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 150,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 0,
            radiusMultiplier: 0.28,
            innateChainDamage: 6, 
            description: "Evo2: Chains damage to nearby bricks."
        },
        explosive: {
            evoTier: 1,
            hasDyingState: true,
            launchCost: 0,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 2,
            radiusTiles: 2.5,
            damage: 10,
            radiusMultiplier: 0.28,
            description: "Explodes in a 2.5 tiles radius."
        },
        draining: { // Explode Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 2,
            radiusTiles: 2.5,
            explosiveDamageMin: 10,
            explosiveDamageMax: 40,
            explosiveDamageHPGradient: [1.0, 0.0], // 1.0 (at 0 HP) -> 0.0 (at Max HP) influence of Max Damage
            radiusMultiplier: 0.28,
            description: "Evo2: Damage scales with missing HP."
        },
        spray: { // Explode Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 3, // +1 use
            radiusTiles: 2.5,
            damage: 10,
            radiusMultiplier: 0.28,
            description: "Evo2: Standard explosion but with 3 uses."
        },
        piercing: {
            evoTier: 1,
            hasDyingState: false,
            launchCost: 0,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 2,
            baseDamage: 10,
            powerUpUses: 2,
            contactCount: 5,
            radiusMultiplier: 0.28,
            damageBuffOnPowerUp: 0,
            description: "Phases through 5 bricks."
        },
        phaser: { // Pierce Evo 2
            evoTier: 2,
            hasDyingState: false,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 2,
            baseDamage: 10,
            powerUpUses: 2,
            phaseDuration: 0.7, // seconds
            radiusMultiplier: 0.28,
            damageBuffOnPowerUp: 0,
            description: "Evo2: Ignores all bricks for 0.7s."
        },
        grow: { // Pierce Evo 2
            evoTier: 2,
            hasDyingState: false,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 2,
            baseDamage: 10,
            powerUpUses: 2,
            contactCount: 5,
            radiusMultiplier: 0.28,
            growAmount: 0.5, // +50% Area
            damageBuffOnPowerUp: 0,
            description: "Evo2: Size increases by 50% on power-up."
        },
        split: {
            evoTier: 1,
            hasDyingState: true,
            launchCost: 0,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 1,
            miniBallCount: 2,
            radiusMultiplier: 0.28,
            description: "Spawns 2 mini-balls."
        },
        cluster: { // Split Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 1,
            miniBallCount: 4, 
            radiusMultiplier: 0.30,
            innateArmor: 1,
            description: "Evo2: Spawns 4 mini-balls."
        },
        cell: { // Split Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 0, 
            radiusMultiplier: 0.28,
            innateArmor: 1,
            description: "Evo2: Spawns mini-balls on brick kill."
        },
        brick: {
            evoTier: 1,
            hasDyingState: true,
            launchCost: 0,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 1,
            spawnRadiusTiles: 3,
            coinChancePercent: 20,
            radiusMultiplier: 0.28,
            description: "Spawn a ring of bricks."
        },
        cross: { // Brick Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 1,
            coinChancePercent: 20,
            radiusMultiplier: 0.28,
            description: "Evo2: Spawns bricks in cross pattern."
        },
        hollow: { // Brick Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 1,
            spawnRadiusTiles: 3,
            coinChancePercent: 20,
            radiusMultiplier: 0.28,
            description: "Evo2: Pushes bricks before spawning."
        },
        bullet: {
            evoTier: 1,
            hasDyingState: true,
            launchCost: 0,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 3,
            speedMultiplier: 0.6,
            bulletDamage: 40,
            bulletCountOnPowerup: 4,
            radiusMultiplier: 0.28,
            description: "Fires 4 projectiles."
        },
        octo: { // Bullet Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 3,
            speedMultiplier: 0.6,
            bulletDamage: 30,
            bulletCountOnPowerup: 8,
            radiusMultiplier: 0.28,
            description: "Evo2: Fires 8 projectiles."
        },
        gatling: { // Bullet Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 2,
            bulletDamage: 40,
            bulletCountOnPowerup: 6,
            bulletInterval: 4, // frames
            bulletSpreadAngle: 0.1, // radians
            radiusMultiplier: 0.28,
            description: "Evo2: Fires burst of projectiles."
        },
        homing: {
            evoTier: 1,
            hasDyingState: true,
            launchCost: 0,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 2,
            turnRate: 0.2,
            damage: 20,
            explosionRadiusTiles: 1.5,
            radiusMultiplier: 0.28,
            description: "Launches seeking explosion."
        },
        seeker: { // Homing Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 0, // Passive
            damage: 10,
            explosionRadiusTiles: 0.25,
            radiusMultiplier: 0.28,
            description: "Evo2: Passive seeking projectiles."
        },
        chase: { // Homing Evo 2
            evoTier: 2,
            hasDyingState: true,
            launchCost: 200,
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 3,
            damageBuff: 4,
            radiusMultiplier: 0.28,
            description: "Evo2: Redirects to Goal and gains damage."
        },
        giant: {
            evoTier: 1,
            hasDyingState: false,
            launchCost: 0,
            hp: 20,
            wallHitDamage: 1000, 
            brickHitDamage: 1, 
            baseDamage: 1000,
            powerUpUses: 0,
            radiusMultiplier: 0.8,
            description: "Pierces all bricks. Dies on wall."
        },
        miniball: {
            hasDyingState: true,
            wallHitDamage: 2,
            brickHitDamage: 0,
            baseDamage: 6,
            radiusMultiplier: 0.2,
        }
    }
};

export const SUMMON_WEIGHTS = {
    // Evo 1
    classic: 120,
    explosive: 120,
    piercing: 120,
    split: 120,
    brick: 120,
    bullet: 120,
    homing: 120,
    // Evo 2
    strong: 10,
    lightning: 10,
    draining: 10,
    spray: 10,
    phaser: 10,
    grow: 10,
    cluster: 10,
    cell: 10,
    cross: 10,
    hollow: 10,
    octo: 10,
    gatling: 10,
    seeker: 10,
    chase: 10
};

export const NPC_BALL_STATS = {
    NPC_Fast_30: { hp: 30, speedMultiplier: 1.0, cost: 40, radiusMultiplier: 0.18, color: [255, 120, 120], damage: 5, minWaveToAppear: 1 },
    NPC_Fast_60: { hp: 60, speedMultiplier: 1.0, cost: 70, radiusMultiplier: 0.23, color: [255, 120, 120], damage: 5, minWaveToAppear: 3 },
    NPC_Basic_30: { hp: 30, speedMultiplier: 0.5, cost: 30, radiusMultiplier: 0.18, color: [255, 120, 120], damage: 5, minWaveToAppear: 1 },
    NPC_Basic_60: { hp: 60, speedMultiplier: 0.5, cost: 60, radiusMultiplier: 0.23, color: [255, 120, 120], damage: 5, minWaveToAppear: 3 },
    NPC_Basic_100: { hp: 100, speedMultiplier: 0.5, cost: 100, radiusMultiplier: 0.28, color: [255, 120, 120], damage: 5, minWaveToAppear: 5 },
    
    NPC_explode_30: { hp: 30, speedMultiplier: 0.5, cost: 80, radiusMultiplier: 0.18, color: [255, 120, 120], damage: 5, minWaveToAppear: 7, 
        explosionDamage: 10, explosionRadiusTiles: 2.2, triggerThreshold: 0.5 },
    NPC_explode_60: { hp: 60, speedMultiplier: 0.5, cost: 120, radiusMultiplier: 0.23, color: [255, 120, 120], damage: 5, minWaveToAppear: 13,
        explosionDamage: 10, explosionRadiusTiles: 2.2, triggerThreshold: 0.5 },
    NPC_explode_100: { hp: 100, speedMultiplier: 0.5, cost: 170, radiusMultiplier: 0.28, color: [255, 120, 120], damage: 5, minWaveToAppear: 15,
        explosionDamage: 10, explosionRadiusTiles: 2.2, triggerThreshold: 0.5 },
    
    NPC_piercing_30: { hp: 30, speedMultiplier: 0.5, cost: 60, radiusMultiplier: 0.18, color: [255, 120, 120], damage: 5, brickHitDamage: 3, minWaveToAppear: 9,
        piercingCount: 4 },
    NPC_piercing_60: { hp: 60, speedMultiplier: 0.5, cost: 100, radiusMultiplier: 0.23, color: [255, 120, 120], damage: 5, brickHitDamage: 3, minWaveToAppear: 13,
        piercingCount: 4 },
    NPC_piercing_100: { hp: 100, speedMultiplier: 0.5, cost: 140, radiusMultiplier: 0.28, color: [255, 120, 120], damage: 5, brickHitDamage: 3, minWaveToAppear: 15,
        piercingCount: 4 },
    
    NPC_shooting_30: { hp: 30, speedMultiplier: 0.5, cost: 80, radiusMultiplier: 0.18, color: [255, 120, 120], damage: 5, minWaveToAppear: 11,
        projectileDamage: 5 },
    NPC_shooting_60: { hp: 60, speedMultiplier: 0.5, cost: 120, radiusMultiplier: 0.23, color: [255, 120, 120], damage: 5, minWaveToAppear: 13,
        projectileDamage: 5 },
    NPC_shooting_100: { hp: 100, speedMultiplier: 0.5, cost: 170, radiusMultiplier: 0.28, color: [255, 120, 120], damage: 5, minWaveToAppear: 15,
        projectileDamage: 5 },
};

export const ROSTER_CONSTANTS = {
    RANDOM_BALL_COST: 10, // Shells
    SCRAP_REWARD_ESSENCE: 1,
    SCRAP_BASE_AMOUNT: { 1: 1, 2: 10 }, // Evo Tier -> Shells
    SCRAP_ENCHANTMENT_BONUS: [0, 0, 1, 3, 8, 15, 28, 52, 78, 117] // By Level (Index = Level - 1)
};

export const BRICK_STATS = {
    maxHp: {
        normal: 200,
        long: 600,
        wool: 50,
        shieldGen: 50,
        FoodStorage: 100,
        WoodStorage: 100,
        Farmland: 100,
        Sawmill: 100,
        LogBrick: 1,
        BallProducer: 50,
        EmptyCage: 30,
    },
    builder: {
        baseCost: 120,
        costPer10Hp: 20,
    },
    healer: {
        baseCost: 80,
        costPer10Hp: 20,
    },
    zapper: {
        baseCost: 100,
        costPer10Hp: 30,
        damage: 5,
        intervalFrames: 15, // 0.25s at 60fps
    },
    zap_battery: {
        baseCost: 0,
        costPer10Hp: 20,
    },
    spike: {
        baseCost: 20,
        costPer10Hp: 40,
        damage: 5,
    },
    sniper: {
        baseCost: 60,
        costPer10Hp: 20,
        damage: 10,
        rangeTiles: 4.5,
        cooldownFrames: 240, // 4 seconds
    },
    laser: {
        baseCost: 60,
        costPer10Hp: 20,
        damage: 10,
    },
    merging: {
        cost: 600,
    },
    explosive: {
        radiusTiles: 2.5,
        damage: 30,
    },
    stripe: {
        damage: 30,
    },
    mine: {
        radiusTiles: 1.2,
        damage: 10,
    },
    wool: {
        costPer10Hp: 30,
    },
    shieldGen: {
        baseCost: 300,
        costPer10Hp: 50,
        auraRadiusTiles: 2.5,
        damageReduction: 0.5,
    },
    canReceiveHealing: {
        normal: true,
        goal: true,
        extraBall: true,
        explosive: false,
        horizontalStripe: false,
        verticalStripe: false,
        ballCage: false,
        equipment: false,
        wool: false,
        shieldGen: false,
        FoodStorage: true,
        WoodStorage: true,
        Farmland: true,
        Sawmill: true,
        LogBrick: false,
        BallProducer: true,
        EmptyCage: true,
        spike: false,
        sniper: false,
        laser: false,
    },
    canCarryCoin: {
        normal: true,
        goal: false,
        extraBall: false,
        explosive: false,
        horizontalStripe: false,
        verticalStripe: false,
        ballCage: false,
        equipment: false,
        wool: true,
        shieldGen: false,
        FoodStorage: false,
        WoodStorage: false,
        Farmland: false,
        Sawmill: false,
        LogBrick: false,
        BallProducer: false,
        EmptyCage: false,
        spike: false,
        sniper: false,
        laser: false,
    },
    canCarryFood: {
        normal: true,
        goal: false,
        extraBall: false,
        explosive: false,
        horizontalStripe: false,
        verticalStripe: false,
        ballCage: false,
        equipment: false,
        wool: true,
        shieldGen: false,
        FoodStorage: false,
        WoodStorage: false,
        Farmland: false,
        Sawmill: false,
        LogBrick: false,
        BallProducer: false,
        EmptyCage: false,
        spike: false,
        sniper: false,
        laser: false,
    },
    canCarryGem: {
        normal: true,
        goal: false,
        extraBall: false,
        explosive: false,
        horizontalStripe: false,
        verticalStripe: false,
        ballCage: false,
        equipment: false,
        wool: true,
        shieldGen: false,
        FoodStorage: false,
        WoodStorage: false,
        Farmland: false,
        Sawmill: false,
        LogBrick: false,
        BallProducer: false,
        EmptyCage: false,
        spike: false,
        sniper: false,
        laser: false,
    },
    canBeProtectedByShieldGen: {
        normal: true,
        goal: true,
        extraBall: true,
        explosive: true,
        horizontalStripe: true,
        verticalStripe: true,
        ballCage: true,
        equipment: true,
        wool: true,
        shieldGen: false,
        FoodStorage: true,
        WoodStorage: true,
        Farmland: true,
        Sawmill: true,
        LogBrick: false,
        BallProducer: true,
        EmptyCage: true,
        spike: true,
        sniper: true,
        laser: true,
    }
};

export const ENCHANTMENT_OUTCOMES = {
    classic: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Chain Damage', text: '+2 Chain Damage', apply: (stats) => stats.bonusChainDamage = (stats.bonusChainDamage || 0) + 2 } },
    strong: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Chain Damage', text: '+2 Chain Damage', apply: (stats) => stats.bonusChainDamage = (stats.bonusChainDamage || 0) + 2 } },
    lightning: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Chain Damage', text: '+2 Chain Damage', apply: (stats) => stats.bonusChainDamage = (stats.bonusChainDamage || 0) + 2 } },
    explosive: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Power-up', text: '+0.2 Explosion Radius', apply: (stats) => stats.bonusPowerUpValue = (stats.bonusPowerUpValue || 0) + 0.2 } },
    draining: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Power-up', text: '+0.2 Explosion Radius', apply: (stats) => stats.bonusPowerUpValue = (stats.bonusPowerUpValue || 0) + 0.2 } },
    spray: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Power-up', text: '+0.2 Explosion Radius', apply: (stats) => stats.bonusPowerUpValue = (stats.bonusPowerUpValue || 0) + 0.2 } },
    piercing: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Shield Duration', text: '+0.7s Shield Duration', apply: (stats) => stats.bonusEnergyShieldDuration = (stats.bonusEnergyShieldDuration || 0) + 0.7 } },
    phaser: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Shield Duration', text: '+0.7s Shield Duration', apply: (stats) => stats.bonusEnergyShieldDuration = (stats.bonusEnergyShieldDuration || 0) + 0.7 } },
    grow: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Shield Duration', text: '+0.7s Shield Duration', apply: (stats) => stats.bonusEnergyShieldDuration = (stats.bonusEnergyShieldDuration || 0) + 0.7 } },
    split: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Armor', text: '+1 Armor', apply: (stats) => stats.bonusMainBallArmor = (stats.bonusMainBallArmor || 0) + 1 } },
    cluster: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Armor', text: '+1 Armor', apply: (stats) => stats.bonusMainBallArmor = (stats.bonusMainBallArmor || 0) + 1 } },
    cell: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Armor', text: '+1 Armor', apply: (stats) => stats.bonusMainBallArmor = (stats.bonusMainBallArmor || 0) + 1 } },
    brick: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Power-up Mines', text: '+1 Power-up Mine', apply: (stats) => stats.bonusPowerUpMineCount = (stats.bonusPowerUpMineCount || 0) + 1 } },
    cross: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Power-up Mines', text: '+1 Power-up Mine', apply: (stats) => stats.bonusPowerUpMineCount = (stats.bonusPowerUpMineCount || 0) + 1 } },
    hollow: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Power-up Mines', text: '+1 Power-up Mine', apply: (stats) => stats.bonusPowerUpMineCount = (stats.bonusPowerUpMineCount || 0) + 1 } },
    bullet: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Last Power-up Bullets', text: '+4 Last Power-up Bullets', apply: (stats) => stats.bonusLastPowerUpBulletCount = (stats.bonusLastPowerUpBulletCount || 0) + 4 } },
    octo: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Last Power-up Bullets', text: '+6 Last Power-up Bullets', apply: (stats) => stats.bonusLastPowerUpBulletCount = (stats.bonusLastPowerUpBulletCount || 0) + 6 } },
    gatling: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Last Power-up Bullets', text: '+4 Last Power-up Bullets', apply: (stats) => stats.bonusLastPowerUpBulletCount = (stats.bonusLastPowerUpBulletCount || 0) + 4 } },
    homing: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Homing Damage', text: '+10 Homing Damage', apply: (stats) => stats.bonusHomingExplosionDamage = (stats.bonusHomingExplosionDamage || 0) + 10 } },
    seeker: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Homing Damage', text: '+10 Homing Damage', apply: (stats) => stats.bonusHomingExplosionDamage = (stats.bonusHomingExplosionDamage || 0) + 10 } },
    chase: { A: { name: 'HP', text: '+15% Max HP', apply: (stats) => stats.hpMultiplier *= 1.15 }, B: { name: 'Damage', text: '+20% Base Damage', apply: (stats) => stats.damageMultiplier *= 1.26 }, C: { name: 'Homing Damage', text: '+10 Homing Damage', apply: (stats) => stats.bonusHomingExplosionDamage = (stats.bonusHomingExplosionDamage || 0) + 10 } },
};

export const GRID_CONSTANTS = {
    BRICK_COLS: 13,
    BRICK_ROWS: 13,
    SAFE_ZONE_GRID: 2, // in grid units
    get TOTAL_COLS() { return this.BRICK_COLS + this.SAFE_ZONE_GRID * 2; },
    get TOTAL_ROWS() { return this.BRICK_ROWS + this.SAFE_ZONE_GRID * 2; },
};

export const BRICK_VISUALS = {
    layersPerTier: 5,
    hpPerLayer: {
        normal: 10,
        long: 30,
        goal: 10,
        extraBall: 10,
        wool: 10,
        shieldGen: 10,
        FoodStorage: 10,
        WoodStorage: 10,
        Farmland: 10,
        Sawmill: 10,
        LogBrick: 10,
        BallProducer: 10,
        EmptyCage: 10,
    },
    palettes: {
        normal: [[100, 150, 255],[110, 100, 210],[120, 50, 165],[125, 0, 125]],
        long: [[100, 150, 255],[110, 100, 210],[120, 50, 165],[125, 0, 125]],
        extraBall: [[0, 255, 127],[45, 200, 85],[55, 150, 50],[50, 115, 5]],
        goal: [[255, 215, 0],[255, 150, 0],[225, 115, 0],[220, 90, 0]],
        wool: [[115, 140, 185]],
        shieldGen: [[0, 229, 255]],
        FoodStorage: [[205, 133, 63]],
        WoodStorage: [[205, 133, 63]],
        Farmland: [[65, 150, 25]],
        Sawmill: [[65, 150, 25]],
        LogBrick: [[139, 69, 19]],
        BallProducer: [[40, 180, 120]],
        EmptyCage: [[100, 150, 255]]
    }
};

export const XP_SETTINGS = {
    xpBaseAmount: 50,
    baseMagneticRadiusMultiplier: 5,
    magneticStrength: 10,
    xpPerOrb: 10,
    invulnerableTime: 60,
};

export const AIMING_SETTINGS = {
    GHOST_BALL_COOLDOWN: 10,
    GHOST_BALL_SPEED_MULTIPLIER: 0.75,
    AIM_CANCEL_RADIUS_MULTIPLIER: 2.5,
};

export const UNLOCK_LEVELS = {
    EXPLOSIVE_BALL: 2,
    COINS_SHOP: 3,
    COMBO_MINES: 4,
    GEMS_SKILLTREE: 5,
    GEM_ROOM: 6,
    SPLIT_BALL: 6,
    EXPLOSIVE_BRICK: 7,
    SHOP_BUY_BALL: 8,
    PIERCING_BALL: 9,
    DANGER_LUCKY_ROOMS: 10,
    EQUIPMENT: 10,
    STRIPE_BONUS: 11,
    BRICK_BALL: 12,
    HOME_BASE: 13,
    REWARD_GEMS_LVL_13: -1, //unused
    GIANT_BONUS: 14,
    BULLET_BALL: 15,
    EQUIPMENT_SLOT_3: 16,
    INVASION_MODE: 17,
    HOMING_BALL: 18,
    BALL_CAGE_BRICK: 19,
    SPECIAL_BRICKS: 1,
    ENCHANTMENT: 20,
    BALL_ROSTER: 20,
    TRIAL_RUN: 22,
    OVERLAY_SHOP: 24,
    BRICK_UPGRADE: 26,
    BALL_SUMMON: 28,
};

export const DEFAULT_LEVEL_SETTINGS = {
    seed: null,
    levelPattern: 'formulaic',
    startingBalls: 5,
    ballSpeed: 0.4,
    goalBricks: 3,
    goalBrickCountIncrement: 0.25,
    goalBrickCap: 8,
    goalBrickMaxHp: 100,
    extraBallBricks: 1,
    explosiveBrickChance: 0.04,
    ballCageBrickChance: 0.05,
    builderBrickChance: 0.03,
    healerBrickChance: 0.03,
    brickCount: 15,
    brickCountIncrement: 8,
    maxBrickCount: 100,
    fewBrickLayoutChance: 0.15,
    fewBrickLayoutChanceMinLevel: 10,
    startingBrickHp: 100,
    brickHpIncrement: 80,
    brickHpIncrementMultiplier: 1.05,
    maxBrickHpIncrement: 500,
    startingCoin: 3,
    coinIncrement: 3,
    maxCoin: 300,
    bonusLevelInterval: 5,
    minCoinBonusMultiplier: 7,
    maxCoinBonusMultiplier: 10,
    equipmentBrickInitialChance: 0.1,
    equipmentBrickChancePerLevel: 0.1,
    overlaySpawnLevels: { spike: 30, sniper: 50, laser: 70 },
};

export const DEFAULT_INVASION_SETTINGS = {
    startingHPPool: 200,
    hpPoolIncrementPerWave: 30,
    minEnemyTypes: 1,
    maxEnemyTypes: 5,
};

export const TRIAL_RUN_LEVEL_SETTINGS = {
    ...DEFAULT_LEVEL_SETTINGS,
    extraBallBricks: 0,
    brickCount: 60,
    startingBrickHp: 1000,
    brickHpIncrement: 150,
    fewBrickLayoutChance: 0,
    startingCoin: 0,
    coinIncrement: 0,
    maxCoin: 0,
    equipmentBrickInitialChance: 0,
    equipmentBrickChancePerLevel: 0,
    ballCageBrickChance: 0,
    goalBricks: 4,
    explosiveBrickChance: 0.02,
    overlaySpawnLevels: { spike: 1, sniper: 8, laser: 15 },
};

export const SHOP_PARAMS = {
    buyBall: { baseCost: 30, increment: 10 },
    mysteriousEquipment: { baseCost: 100, increment: 75 },
    costIncrementRate: 1.5,
    // Defaults
    extraBallHp: { baseCost: 50, value: 10, baseValue: 0 },
    aimLength: { baseCost: 30, value: 0.2, baseValue: 0.4 },
    bonusXp: { baseCost: 50, value: 10, baseValue: 0 },
    maxChargeCapacity: { baseCost: 30, value: 25, baseValue: 500 },
    
    // Ball Specific - RENAMED AND ADDITIVE
    classic_directDamage: { baseCost: 80, value: 2, baseValue: 0 },
    strong_directDamage: { baseCost: 80, value: 4, baseValue: 0 },
    lightning_chainDamage: { baseCost: 100, value: 2, baseValue: 0 },
    explosive_powerup_explosionDamage: { baseCost: 50, value: 4, baseValue: 0 },
    draining_powerup_explosionDamage: { baseCost: 40, value: 4, baseValue: 0 },
    spray_powerup_explosionDamage: { baseCost: 60, value: 4, baseValue: 0 },
    piercing_powerup_directDamage: { baseCost: 40, value: 2, baseValue: 0 },
    phaser_powerup_directDamage: { baseCost: 40, value: 2, baseValue: 0 },
    grow_powerup_directDamage: { baseCost: 50, value: 2, baseValue: 0 },
    split_spawned_miniball_damage: { baseCost: 80, value: 2, baseValue: 0 },
    cluster_spawned_miniball_damage: { baseCost: 100, value: 2, baseValue: 0 },
    cell_spawned_miniball_damage: { baseCost: 120, value: 2, baseValue: 0 },
    brick_special_coinChance: { baseCost: 50, value: 6, baseValue: 0 },
    cross_special_coinChance: { baseCost: 40, value: 6, baseValue: 0 },
    hollow_special_coinChance: { baseCost: 50, value: 6, baseValue: 0 },
    bullet_powerup_bulletDamage: { baseCost: 70, value: 10, baseValue: 0 },
    octo_powerup_bulletDamage: { baseCost: 120, value: 10, baseValue: 0 },
    gatling_powerup_bulletCount: { baseCost: 50, value: 1, baseValue: 0 },
    homing_powerup_projectile_explosionRadius: { baseCost: 80, value: 0.2, baseValue: 0 },
    seeker_directDamage: { baseCost: 70, value: 2, baseValue: 0 },
    chase_powerup_directDamage: { baseCost: 100, value: 3, baseValue: 0 },
};

export const EQUIPMENT_SLOT_COSTS = {
    2: 8,
    3: 30,
};

export const INITIAL_UPGRADE_STATE = {
    extraBallHp: { level: 1 },
    aimLength: { level: 1 },
    bonusXp: { level: 1 },
    maxChargeCapacity: { level: 1 },
    classic_directDamage: { level: 1 },
    strong_directDamage: { level: 1 },
    lightning_chainDamage: { level: 1 },
    explosive_powerup_explosionDamage: { level: 1 },
    draining_powerup_explosionDamage: { level: 1 },
    spray_powerup_explosionDamage: { level: 1 },
    piercing_powerup_directDamage: { level: 1 },
    phaser_powerup_directDamage: { level: 1 },
    grow_powerup_directDamage: { level: 1 },
    split_spawned_miniball_damage: { level: 1 },
    cluster_spawned_miniball_damage: { level: 1 },
    cell_spawned_miniball_damage: { level: 1 },
    brick_special_coinChance: { level: 1 },
    cross_special_coinChance: { level: 1 },
    hollow_special_coinChance: { level: 1 },
    bullet_powerup_bulletDamage: { level: 1 },
    octo_powerup_bulletDamage: { level: 1 },
    gatling_powerup_bulletCount: { level: 1 },
    homing_powerup_projectile_explosionRadius: { level: 1 },
    seeker_directDamage: { level: 1 },
    chase_powerup_directDamage: { level: 1 },
};

export const UPGRADE_UNLOCK_LEVELS = {
    extraBallHp: 1,
    aimLength: 1,
    bonusXp: 999, // Unlocked via skill tree
    maxChargeCapacity: 1, 
    classic_directDamage: 1,
    strong_directDamage: 1,
    lightning_chainDamage: 1,
    explosive_powerup_explosionDamage: UNLOCK_LEVELS.EXPLOSIVE_BALL,
    draining_powerup_explosionDamage: 1,
    spray_powerup_explosionDamage: 1,
    piercing_powerup_directDamage: UNLOCK_LEVELS.PIERCING_BALL,
    phaser_powerup_directDamage: 1,
    grow_powerup_directDamage: 1,
    split_spawned_miniball_damage: UNLOCK_LEVELS.SPLIT_BALL,
    cluster_spawned_miniball_damage: 1,
    cell_spawned_miniball_damage: 1,
    brick_special_coinChance: UNLOCK_LEVELS.BRICK_BALL,
    cross_special_coinChance: 1,
    hollow_special_coinChance: 1,
    bullet_powerup_bulletDamage: UNLOCK_LEVELS.BULLET_BALL,
    octo_powerup_bulletDamage: 1,
    gatling_powerup_bulletCount: 1,
    homing_powerup_projectile_explosionRadius: UNLOCK_LEVELS.HOMING_BALL,
    seeker_directDamage: 1,
    chase_powerup_directDamage: 1,
};

export const HOME_BASE_PRODUCTION = {
    BALL_COST_FOOD: 50,
    BALL_TIME_FRAMES: 3600,
    PRODUCIBLE_BALLS: [
        'classic', 'strong', 'lightning', 
        'explosive', 'draining', 'spray',
        'piercing', 'phaser', 'grow',
        'split', 'cluster', 'cell', 
        'brick', 'cross', 'hollow',
        'bullet', 'octo', 'gatling', 
        'homing', 'seeker', 'chase'
    ],
    MAX_QUEUE: 4,
};

export const HOME_BASE_SHOP_ITEMS = [
    { id: 'normal', cost: { wood: 100 } },
    { id: 'Farmland', cost: { wood: 250, gems: 2 } },
    { id: 'Sawmill', cost: { food: 250, gems: 2 } },
    { id: 'FoodStorage', cost: { wood: 250 } },
    { id: 'WoodStorage', cost: { food: 250 } },
    { id: 'BallProducer', cost: { food: 500 } },
    { id: 'EmptyCage', cost: { wood: 500 } }
];

export const HOME_BASE_OVERLAY_SHOP_ITEMS = [
    { type: 'spike', cost: { metal: 10, wire: 3 } },
    { type: 'sniper', cost: { metal: 5, wire: 5 } },
    { type: 'laser', cost: { metal: 5, fuel: 5 } }
];

export const ENCHANTER_STATS = {
    'enchanter1': { name: 'Enchanter I', icon: '🌿', ep: 1 },
    'enchanter2': { name: 'Enchanter II', icon: '🫘', ep: 4 },
    'enchanter3': { name: 'Enchanter III', icon: '🧆', ep: 16 },
    'enchanter4': { name: 'Enchanter IV', icon: '🍬', ep: 64 },
    'enchanter5': { name: 'Enchanter V', icon: '🍭', ep: 250 },
};

export const ENCHANTMENT_REQUIREMENTS = [0, 4, 12, 36, 108, 216, 432, 864, 1296, 1944];

export const INVASION_MODE_PARAMS = {
    ENCHANTER_DROP_RATE_PER_COST: 0.002,
    ENCHANTER_II_UPGRADE_CHANCE: 0.2,
    ECT3_CHANCE_PER_1000_COST: 0.05,
    SHELL_DROP_RATE_PER_COST: 0.001,
    SHELL_DROP_AMOUNT_MIN: 2,
    SHELL_DROP_AMOUNT_MAX: 5,
};

export const INVASION_SHOP_ITEMS = [
    { id: 'normal', name: 'Place Normal Brick', description: 'Places a new Level 1 Normal Brick in a random empty spot.', baseCost: 25, costIncrement: 5, action: 'placeBrick' },
    { id: 'shieldGen', name: 'Place Shield Gen', description: 'Places a new Shield Generator brick that protects nearby bricks.', baseCost: 200, costIncrement: 50, action: 'placeBrick' },
    { id: 'spike', name: 'Apply Spike Overlay', description: 'Adds a Spike overlay (Lv.1) to a random Normal Brick.', baseCost: 25, costIncrement: 10, action: 'applyOverlay' },
    { id: 'sniper', name: 'Apply Sniper Overlay', description: 'Adds a Sniper overlay (Lv.1) to a random Normal Brick.', baseCost: 75, costIncrement: 20, action: 'applyOverlay' }
];

export const INVASION_MYSTERY_POOL = [
    { id: 'heal_1', type: 'heal', count: 1, min: 7, max: 35, name: "Heal 1 Random Brick" },
    { id: 'heal_3', type: 'heal', count: 3, min: 36, max: 144, name: "Heal 3 Random Bricks" },
    { id: 'heal_10', type: 'heal', count: 10, min: 72, max: 216, name: "Heal 10 Random Bricks" },
    { id: 'heal_all', type: 'heal', count: 999, min: 144, max: 432, name: "Heal All Bricks" },
    { id: 'hp_10', type: 'buff', amount: 5, min: 72, max: 287, name: "+5 HP to All Bricks" },
    { id: 'hp_20', type: 'buff', amount: 10, min: 144, max: 575, name: "+10 HP to All Bricks" },
    { id: 'hp_40', type: 'buff', amount: 20, min: 288, max: 864, name: "+20 HP to All Bricks" },
    { id: 'hp_70', type: 'buff', amount: 40, min: 576, max: 1152, name: "+40 HP to All Bricks" },
    { id: 'sniper_2', type: 'overlay', overlay: 'sniper', level: 2, min: 37, max: 148, name: "Sniper Lv.2 Overlay" },
    { id: 'sniper_3', type: 'overlay', overlay: 'sniper', level: 3, min: 111, max: 387, name: "Sniper Lv.3 Overlay" },
    { id: 'sniper_4', type: 'overlay', overlay: 'sniper', level: 4, min: 275, max: 825, name: "Sniper Lv.4 Overlay" },
    { id: 'sniper_5', type: 'overlay', overlay: 'sniper', level: 5, min: 412, max: 1030, name: "Sniper Lv.5 Overlay" },
    { id: 'spike_3', type: 'overlay', overlay: 'spike', level: 3, min: 37, max: 148, name: "Spike Lv.3 Overlay" },
    { id: 'spike_4', type: 'overlay', overlay: 'spike', level: 4, min: 111, max: 387, name: "Spike Lv.4 Overlay" },
    { id: 'spike_5', type: 'overlay', overlay: 'spike', level: 5, min: 275, max: 825, name: "Spike Lv.5 Overlay" },
    { id: 'spike_6', type: 'overlay', overlay: 'spike', level: 6, min: 412, max: 1030, name: "Spike Lv.6 Overlay" },
    { id: 'add_goal', type: 'brick', brick: 'goal', min: 24, max: 999, name: "Add 1 Goal Brick" },
    { id: 'add_shield', type: 'brick', brick: 'shieldGen', min: 127, max: 575, name: "Add 1 ShieldGen Brick" },
    { id: 'ench_1', type: 'enchanter', subtype: 'enchanter1', minEa: 6, maxEa: 30, minStack: 1, maxStack: 15 },
    { id: 'ench_2', type: 'enchanter', subtype: 'enchanter2', minEa: 22, maxEa: 88, minStack: 1, maxStack: 8 },
    { id: 'ench_3', type: 'enchanter', subtype: 'enchanter3', minEa: 75, maxEa: 256, minStack: 1, maxStack: 3 },
    { id: 'ench_4', type: 'enchanter', subtype: 'enchanter4', minEa: 225, maxEa: 750, minStack: 1, maxStack: 1 },
];

export const EQUIPMENT_RARITY_WEIGHTS = {
    base: { common: 60, rare: 30, epic: 10 },
    upgraded: { common: 50, rare: 40, epic: 15 }
};
