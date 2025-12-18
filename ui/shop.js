
// ui/shop.js
import * as dom from '../dom.js';
import { state, applyAllUpgrades } from '../state.js';
import { UNLOCK_LEVELS, BALL_STATS } from '../balancing.js';
import { sounds } from '../sfx.js';
import { ALL_EQUIPMENT_IDS, generateRandomEquipment } from '../equipment.js';

function handleUpgrade(upgradeKey, gameController) {
    if (!gameController) return;
    const coins = gameController.getCoins();
    const upgrade = state.upgradeState[upgradeKey];
    const { baseCost } = state.shopParams[upgradeKey];
    const cost = Math.floor(baseCost * Math.pow(state.shopParams.costIncrementRate, upgrade.level - 1));
    if (coins >= cost) { 
        gameController.setCoins(coins - cost); 
        upgrade.level++; 
        sounds.upgrade();
        applyAllUpgrades();
        updateShopUI(gameController); 
    }
}

export function updateShopUI(gameController) {
    if (!gameController) return;
    const coins = gameController.getCoins();
    dom.shopCoinCount.textContent = coins;
    let firstBallCost = state.shopParams.buyBall.baseCost + state.ballPurchaseCount * state.shopParams.buyBall.increment;
    if (state.ballPurchaseCount === 0 && !!state.skillTreeState['discount_first_ball']) {
        firstBallCost = Math.max(0, firstBallCost - 10);
    }

    state.currentBallCost = firstBallCost;

    dom.buyBallButton.textContent = `${state.currentBallCost} 🪙`;
    dom.buyBallButton.disabled = coins < state.currentBallCost;
    
    document.getElementById('buyBallCard').classList.toggle('hidden', state.mainLevel < UNLOCK_LEVELS.SHOP_BUY_BALL);
    
    // Equipment Card
    const existingEqCard = document.getElementById('buyEquipmentCard');
    if (existingEqCard) existingEqCard.remove();
    
    if (state.mainLevel >= UNLOCK_LEVELS.EQUIPMENT) {
        const ownedEquipmentIds = state.playerEquipment.map(eq => eq.id);
        const canBuyEquipment = ownedEquipmentIds.length < ALL_EQUIPMENT_IDS.length;
        const buyEquipmentCost = state.shopParams.mysteriousEquipment.baseCost + state.equipmentPurchaseCount * state.shopParams.mysteriousEquipment.increment;
    
        const buyEquipmentCard = document.createElement('div');
        buyEquipmentCard.id = 'buyEquipmentCard';
        buyEquipmentCard.className = 'buy-ball-card';
        buyEquipmentCard.innerHTML = `
            <h4>Mysterious Equipment</h4>
            <p>Buy a random piece of new equipment.</p>
            <button id="buyEquipmentButton" class="upgrade-cost-button">${buyEquipmentCost} 🪙</button>
        `;
        dom.buyBallButton.parentElement.insertAdjacentElement('afterend', buyEquipmentCard);
    
        const buyEquipmentButton = document.getElementById('buyEquipmentButton');
        buyEquipmentButton.disabled = coins < buyEquipmentCost || !canBuyEquipment;
        if (!canBuyEquipment) {
            buyEquipmentButton.textContent = 'All Found';
        }
        buyEquipmentButton.onclick = () => {
            if (coins >= buyEquipmentCost && canBuyEquipment) {
                gameController.setCoins(coins - buyEquipmentCost);
                state.equipmentPurchaseCount++;
                const newEquipment = generateRandomEquipment(state.playerEquipment.map(eq => eq.id));
                if (newEquipment) {
                    state.playerEquipment.push(newEquipment);
                    state.discoveredEquipment.add(newEquipment.id);
                    sounds.equipmentGet();
                    dom.runEquipmentBtn.classList.add('glow');

                    const text = `${newEquipment.name} (${newEquipment.rarity})`;
                    let color;
                    let glow = false;
                    const p = state.p5Instance;
                    if(p) {
                        switch (newEquipment.rarity) {
                            case 'Common': color = p.color(255, 255, 255); break;
                            case 'Rare': color = p.color(75, 141, 248); break;
                            case 'Epic':
                                color = p.color(164, 96, 248);
                                glow = true;
                                break;
                            default: color = p.color(255);
                        }
                        gameController.addFloatingText(text, color, { size: 18, isBold: true, lifespan: 150, glow });
                    }
                }
                updateShopUI(gameController);
            }
        };
    }

    // New Mappings using renamed keys
    const upgradeData = {
        extraBallHp: { name: "Extra HP", label: "HP Bonus", base: 0, isExtra: true },
        aimLength: { name: "Aim Length", label: "Length", base: 0.4, isTime: true },
        bonusXp: { name: "Bonus XP", label: "XP", base: 0, isPercent: true },
        maxChargeCapacity: { name: "Max Charge", label: "Capacity", base: 500 },
        
        classic_directDamage: { name: "Classic Ball", label: "Direct Damage", ballType: 'classic', baseKey: 'damage' },
        strong_directDamage: { name: "Strong Ball", label: "Direct Damage", ballType: 'strong', baseKey: 'damage' },
        lightning_chainDamage: { name: "Lightning Ball", label: "Chain Damage", ballType: 'lightning', baseKey: 'chainDamage' },
        
        explosive_powerup_explosionDamage: { name: "Explode Ball", label: "Explosion Damage", ballType: 'explosive', baseKey: 'splashDamage' },
        draining_powerup_explosionDamage: { name: "Draining Ball", label: "Explosion Damage", ballType: 'draining', baseKey: 'splashDamage' },
        spray_powerup_explosionDamage: { name: "Spray Ball", label: "Min Explosion Damage", ballType: 'spray', baseKey: 'minSplashDamage' },
        
        piercing_powerup_directDamage: { name: "Pierce Ball", label: "Bonus Damage on Power-up", ballType: 'piercing', baseKey: 'abilityDamage' },
        phaser_powerup_directDamage: { name: "Phaser Ball", label: "Bonus Damage on Power-up", ballType: 'phaser', baseKey: 'abilityDamage' },
        grow_powerup_directDamage: { name: "Grow Ball", label: "Bonus Damage on Power-up", ballType: 'grow', baseKey: 'abilityDamage' },
        
        split_spawned_miniball_damage: { name: "Split Ball", label: "Mini-Ball Damage", ballType: 'split', baseKey: 'miniDamage' },
        cluster_spawned_miniball_damage: { name: "Cluster Ball", label: "Mini-Ball Damage", ballType: 'cluster', baseKey: 'miniDamage' },
        cell_spawned_miniball_damage: { name: "Cell Ball", label: "Mini-Ball Damage", ballType: 'cell', baseKey: 'miniDamage' },
        
        brick_special_coinChance: { name: "Brick Ball", label: "Coin Chance", ballType: 'brick', baseKey: 'coinChance', isPercent: true },
        cross_special_coinChance: { name: "Cross Ball", label: "Coin Chance", ballType: 'cross', baseKey: 'coinChance', isPercent: true },
        hollow_special_coinChance: { name: "Hollow Ball", label: "Coin Chance", ballType: 'hollow', baseKey: 'coinChance', isPercent: true },
        
        bullet_powerup_bulletDamage: { name: "Bullet Ball", label: "Bullet Damage", ballType: 'bullet', baseKey: 'bulletDamage' },
        octo_powerup_bulletDamage: { name: "Octo Ball", label: "Bullet Damage", ballType: 'octo', baseKey: 'bulletDamage' },
        gatling_powerup_bulletCount: { name: "Gatling Ball", label: "Bullet Count", ballType: 'gatling', baseKey: 'bulletCount' },
        
        homing_powerup_projectile_explosionRadius: { name: "Homing Ball", label: "Explosion Radius", ballType: 'homing', baseKey: 'splashRadius', isTiles: true },
        seeker_directDamage: { name: "Seeker Ball", label: "Direct Damage", ballType: 'seeker', baseKey: 'damage' },
        chase_powerup_directDamage: { name: "Chase Ball", label: "Bonus Damage on Power-up", ballType: 'chase', baseKey: 'abilityDamage' },
    };
    
    // Upgrade Order
    const upgradeOrder = ['extraBallHp', 'aimLength'];
    if (!!state.skillTreeState['unlock_bonus_xp']) upgradeOrder.push('bonusXp');

    const equippedBalls = state.currentLoadout.map(id => state.ballInventory.find(bi => bi.instanceId === id)).filter(Boolean);
    const usesCharge = equippedBalls.some(b => (BALL_STATS.types[b.type]?.launchCost || 0) > 0);
    if (usesCharge) upgradeOrder.push('maxChargeCapacity');

    const typeToUpgradeKey = {
        classic: 'classic_directDamage',
        strong: 'strong_directDamage',
        lightning: 'lightning_chainDamage',
        explosive: 'explosive_powerup_explosionDamage',
        draining: 'draining_powerup_explosionDamage',
        spray: 'spray_powerup_explosionDamage',
        piercing: 'piercing_powerup_directDamage',
        phaser: 'phaser_powerup_directDamage',
        grow: 'grow_powerup_directDamage',
        split: 'split_spawned_miniball_damage',
        cluster: 'cluster_spawned_miniball_damage',
        cell: 'cell_spawned_miniball_damage',
        brick: 'brick_special_coinChance',
        cross: 'cross_special_coinChance',
        hollow: 'hollow_special_coinChance',
        bullet: 'bullet_powerup_bulletDamage',
        octo: 'octo_powerup_bulletDamage',
        gatling: 'gatling_powerup_bulletCount',
        homing: 'homing_powerup_projectile_explosionRadius',
        seeker: 'seeker_directDamage',
        chase: 'chase_powerup_directDamage'
    };

    const addedKeys = new Set();
    equippedBalls.forEach(ball => {
        const key = typeToUpgradeKey[ball.type];
        if (key && !addedKeys.has(key)) {
            upgradeOrder.push(key);
            addedKeys.add(key);
        }
    });

    dom.upgradesGrid.innerHTML = '';
    for (const key of upgradeOrder) {
        if (!state.upgradeState[key] || !state.shopParams[key]) continue;
        
        const { level } = state.upgradeState[key];
        const { baseCost, value } = state.shopParams[key];
        const cost = Math.floor(baseCost * Math.pow(state.shopParams.costIncrementRate, level - 1));
        
        const info = upgradeData[key];
        let effectiveBaseValue = info.base !== undefined ? info.base : 0;
        if (info.ballType && state.effectiveShopBases[info.ballType]) {
            effectiveBaseValue = state.effectiveShopBases[info.ballType][info.baseKey];
        }

        const bonusValue = (level - 1) * value;

        let baseDisplay, bonusDisplay;
        if (info.isPercent) {
            baseDisplay = `${Math.round(effectiveBaseValue)}%`;
            bonusDisplay = `(+${Math.round(bonusValue)}%)`;
        } else if (info.isTime) {
            baseDisplay = `${effectiveBaseValue.toFixed(1)}s`;
            bonusDisplay = `(+${bonusValue.toFixed(1)}s)`;
        } else if (info.isTiles) {
            baseDisplay = effectiveBaseValue.toFixed(1);
            bonusDisplay = `(+${bonusValue.toFixed(1)})`;
        } else if (info.isExtra) {
            baseDisplay = `+${Math.round(effectiveBaseValue)}`;
            bonusDisplay = `(+${Math.round(bonusValue)})`;
        } else {
            baseDisplay = `${Number.isInteger(effectiveBaseValue) ? effectiveBaseValue : effectiveBaseValue.toFixed(1)}`;
            bonusDisplay = `(+${Number.isInteger(bonusValue) ? bonusValue : bonusValue.toFixed(1)})`;
        }
        
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
            <div>
                <div class="upgrade-card-header">${info.name}</div>
                <div class="upgrade-card-level">LVL ${level}</div>
                <div class="upgrade-card-stat">
                    <div style="font-size: 0.8em; color: #aaa;">${info.label}</div>
                    ${baseDisplay} <span class="next-value">${bonusDisplay}</span>
                </div>
            </div>
            <button class="upgrade-cost-button" data-upgrade-key="${key}" ${coins < cost ? 'disabled' : ''}>${cost} 🪙</button>
        `;
        dom.upgradesGrid.appendChild(card);
    }

    document.querySelectorAll('.upgrade-cost-button[data-upgrade-key]').forEach(button => {
        button.onclick = () => handleUpgrade(button.dataset.upgradeKey, gameController);
    });
}
