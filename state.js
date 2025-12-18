
// state.js
import { SHOP_PARAMS, INITIAL_UPGRADE_STATE, XP_SETTINGS, TRIAL_RUN_LEVEL_SETTINGS, BALL_STATS, ENCHANTMENT_OUTCOMES } from './balancing.js';

// This file holds the canonical state for the application.
// Other modules can modify the properties of this single state object.

export const state = {
    p5Instance: null,
    gameMode: 'homeBase', // 'homeBase' | 'adventureRun' | 'trialRun' | 'invasionDefend'
    isRunning: true,
    isSpedUp: false,
    originalBallSpeed: 0.4,
    selectedBallType: 'classic',
    currentBallCost: 10,
    ballPurchaseCount: 0,
    shopParams: { ...SHOP_PARAMS },
    upgradeState: JSON.parse(JSON.stringify(INITIAL_UPGRADE_STATE)),
    upgradeableStats: {},
    upgradeBonuses: {}, 
    effectiveShopBases: {}, // Values representing (Initial Base + Enchantments)
    isDebugView: false,

    // Debug view toggles
    showEventLogDebug: false,
    showEquipmentDebug: false,

    // Persistent Progression State
    mainLevel: 1,
    currentXp: 0,
    xpForNextLevel: XP_SETTINGS.xpBaseAmount, // Initial requirement for Lvl 1 -> 2 is 50.
    pendingXp: 0,
    playerGems: 0,
    lifetimeGems: 0,
    lifetimeXp: 0,
    playerFood: 1000,
    playerWood: 1000,
    
    // New Roster & Shell System
    playerShells: 0,
    playerBallEssence: 0,
    ballInventory: [], // Array of ball instances: { instanceId, type, level, outcomes, stats, name, isFavorite }
    currentLoadout: [null, null, null, null, null, null, null], // Array of 7 slots containing instanceIds
    
    playerMaterials: {
        metal: 0,
        wire: 0,
        fuel: 0,
    },
    playerEnchanters: {
        enchanter1: 0,
        enchanter2: 0,
        enchanter3: 0,
        enchanter4: 0,
        enchanter5: 0,
    },
    maxFood: 1000,
    maxWood: 1000,
    skillTreeState: {}, // Flat object mapping skill ID to true if purchased
    // Legacy enchantment storage
    ballEnchantments: {
        classic: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusChainDamage: 0, productionCostMultiplier: 1.0 },
        explosive: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusPowerUpValue: 0, productionCostMultiplier: 1.0 },
        piercing: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusEnergyShieldDuration: 0, productionCostMultiplier: 1.0 },
        split: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusMainBallArmor: 0, productionCostMultiplier: 1.0 },
        brick: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusPowerUpMineCount: 0, productionCostMultiplier: 1.0 },
        bullet: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusLastPowerUpBulletCount: 0, productionCostMultiplier: 1.0 },
        homing: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusHomingExplosionDamage: 0, productionCostMultiplier: 1.0 },
    },
    equipmentBrickSpawnChance: 0.1, // Initialized from settings
    milestonesCompleted: {},
    highestLevelReached: 0,
    trialRunHighestLevelReached: 0,
    previousRunLevel: 0,
    homeBaseInventory: [],
    isInitialHomeBaseLayoutLoaded: false,
    discoveredEquipment: new Set(), // Set of equipment IDs discovered in Adventure Run
    firstEquipmentGained: false, // For Row 30 skill Tree
    
    // Goal Brick Progression
    goalBrickLevel: 1,
    goalBrickXp: 0,
    
    // In-run State
    runCharge: 0,
    runMaxCharge: 500,
    nextRoomType: 'normal', // 'normal' | 'gem' | 'food' | 'wood' | 'lucky' | 'danger'
    isGoldenTurn: false,
    trialRunBallStock: {}, // e.g. { classic: 10, explosive: 5 }
    trialRunLevelSettings: { ...TRIAL_RUN_LEVEL_SETTINGS },
    invasionWave: 1,
    invasionBallHPPool: 150,
    invasionSettings: {
        startingHPPool: 150,
        hpPoolIncrementPerWave: 50,
        minEnemyTypes: 1,
        maxEnemyTypes: 3,
    },
    runResourceSpace: { food: 0, wood: 0 }, 
    excessResourceAccumulator: { food: 0, wood: 0 }, 

    // Home Base State
    homeBaseTimeMultiplier: 1,
    homeBaseTimeMultiplierEnd: 0,
    overlayInventory: [], // { id: uuid, type: 'spike', level: 1, hostBrickId: uuid }
    isMovingOverlay: null, // overlayId: uuid
    highlightedIngredientIds: new Set(), // ids of bricks consumed in upgrade
    brickForSellConfirm: null, // Brick object pending sale

    // Editor State
    isEditorMode: false,
    editorTool: 'place',
    editorObject: 'normal',
    editorSelectedItem: null,
    editorSelection: new Set(),
    isDeselectingInEditor: false,

    // Equipment System State
    playerEquipment: [], // Array of equipment objects
    ballEquipment: {
        classic: [null, null, null],
        explosive: [null, null, null],
        piercing: [null, null, null],
        split: [null, null, null],
        brick: [null, null, null],
        bullet: [null, null, null],
        homing: [null, null, null],
        giant: [null, null, null],
    },
    unlockedSlots: {
        classic: 1,
        explosive: 1,
        piercing: 1,
        split: 1,
        brick: 1,
        bullet: 1,
        homing: 1,
        giant: 1,
    },
    equipmentPurchaseCount: 0,
    
    // In-game equipment effect trackers
    wallExplosionCharge: 0,
    invulnerabilityTimer: 0,
    capacitorChargeEffect: 0,
    rampingDamage: 0,
    rampingDamageTimer: 0,
    orbsForHeal: 0,
    hpLostForRetaliation: 0,
    coinsForDuplication: 0,
    phaserCharges: 0,
    zapAuraTimer: 0,
    lastStandCharges: 0,
    orbsForLastStand: 0,
    overflowHealCharges: 0,
    overchargeParticles: [],
    comboParticles: [],
};


export function applyAllUpgrades() {
    const getBonus = (key) => (state.upgradeState[key].level - 1) * state.shopParams[key].value;
    
    // Default Upgrades
    state.upgradeBonuses.extraBallHp = getBonus('extraBallHp');
    state.upgradeableStats.extraBallHp = state.shopParams.extraBallHp.baseValue + state.upgradeBonuses.extraBallHp;
    
    state.upgradeBonuses.aimLength = getBonus('aimLength');
    state.upgradeableStats.aimLength = state.shopParams.aimLength.baseValue + state.upgradeBonuses.aimLength;
    
    state.upgradeBonuses.bonusXp = getBonus('bonusXp');
    state.upgradeableStats.bonusXp = (state.shopParams.bonusXp.baseValue + state.upgradeBonuses.bonusXp) / 100;
    
    state.upgradeBonuses.maxChargeCapacity = getBonus('maxChargeCapacity');
    state.runMaxCharge = state.shopParams.maxChargeCapacity.baseValue + state.upgradeBonuses.maxChargeCapacity;

    // Apply all renamed ball-specific bonuses
    const ballBonusKeys = [
        'classic_directDamage', 'strong_directDamage', 'lightning_chainDamage',
        'explosive_powerup_explosionDamage', 'draining_powerup_explosionDamage', 'spray_powerup_explosionDamage',
        'piercing_powerup_directDamage', 'phaser_powerup_directDamage', 'grow_powerup_directDamage',
        'split_spawned_miniball_damage', 'cluster_spawned_miniball_damage', 'cell_spawned_miniball_damage',
        'brick_special_coinChance', 'cross_special_coinChance', 'hollow_special_coinChance',
        'bullet_powerup_bulletDamage', 'octo_powerup_bulletDamage', 'gatling_powerup_bulletCount',
        'homing_powerup_projectile_explosionRadius', 'seeker_directDamage', 'chase_powerup_directDamage'
    ];

    ballBonusKeys.forEach(key => {
        state.upgradeBonuses[key] = getBonus(key);
    });

    // Effective Base Calculation for Shop
    state.effectiveShopBases = {};
    const ballTypes = Object.keys(BALL_STATS.types);
    ballTypes.forEach(type => {
        const instanceId = state.currentLoadout.find(id => {
            if(!id) return false;
            const b = state.ballInventory.find(bi => bi.instanceId === id);
            return b && b.type === type;
        });

        const mockEnch = { hpMultiplier: 1, damageMultiplier: 1, bonusChainDamage: 0, bonusPowerUpValue: 0, bonusEnergyShieldDuration: 0, bonusMainBallArmor: 0, bonusPowerUpMineCount: 0, bonusLastPowerUpBulletCount: 0, bonusHomingExplosionDamage: 0 };
        if (instanceId) {
            const ball = state.ballInventory.find(b => b.instanceId === instanceId);
            if (ball.outcomes) {
                ball.outcomes.forEach(key => {
                    const def = ENCHANTMENT_OUTCOMES[type][key];
                    if (def) def.apply(mockEnch);
                });
            }
        }

        const stats = BALL_STATS.types[type];
        state.effectiveShopBases[type] = {
            damage: stats.baseDamage * mockEnch.damageMultiplier,
            splashDamage: (stats.damage || stats.explosionDamage || 0) * mockEnch.damageMultiplier,
            minSplashDamage: (stats.explosiveDamageMin || 0) * mockEnch.damageMultiplier,
            chainDamage: (stats.innateChainDamage || 0) + mockEnch.bonusChainDamage,
            abilityDamage: 0, // Used for powerup_directDamage base
            miniDamage: BALL_STATS.types.miniball.baseDamage * mockEnch.damageMultiplier,
            coinChance: stats.coinChancePercent || 0,
            bulletDamage: (stats.bulletDamage || 0) * mockEnch.damageMultiplier,
            bulletCount: stats.bulletCountOnPowerup || 0,
            splashRadius: (stats.radiusTiles || stats.explosionRadiusTiles || 0) + mockEnch.bonusPowerUpValue
        };
    });

    // Global stats helpers
    state.upgradeableStats.brickSummonCoinChance = (state.shopParams.brick_special_coinChance.baseValue + state.upgradeBonuses.brick_special_coinChance) / 100;
    
    let explosiveDamageBonus = 0;
    if (state.gameMode === 'adventureRun') {
        if (state.skillTreeState['explosive_damage_1']) explosiveDamageBonus += 5;
        if (state.skillTreeState['explosive_damage_2']) explosiveDamageBonus += 5;
        if (state.skillTreeState['explosive_damage_3']) explosiveDamageBonus += 5;
    }
    state.upgradeableStats.explosiveBrickDamage = 30 + explosiveDamageBonus;

    // --- Giant Ball HP Bonus ---
    let giantBonusHp = 0;
    if (state.skillTreeState['giant_hp_1']) giantBonusHp += 2;
    if (state.skillTreeState['giant_hp_2']) giantBonusHp += 2;
    if (state.skillTreeState['giant_hp_3']) giantBonusHp += 2;
    state.upgradeableStats.giantHp = BALL_STATS.types.giant.hp + giantBonusHp;

    // --- Resource Spawn Bonuses ---
    const foodSpawnCount = ['food_spawn_1', 'food_spawn_2', 'food_spawn_3', 'food_spawn_4', 'food_spawn_5', 'food_spawn_6'].filter(id => state.skillTreeState[id]).length;
    state.foodSpawnBonus = 1.0 + (foodSpawnCount * 0.05);

    const woodSpawnCount = ['wood_spawn_1', 'wood_spawn_2', 'wood_spawn_3', 'wood_spawn_4', 'wood_spawn_5', 'wood_spawn_6'].filter(id => state.skillTreeState[id]).length;
    state.woodSpawnBonus = 1.0 + (woodSpawnCount * 0.05);
}
