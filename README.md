
# Brick Breaker - Design & Technical Document

This document outlines the design, mechanics, and technical architecture of the p5.js Brick Breaker game.

## Core Gameplay Loop

The game is a modern take on the classic brick breaker genre, incorporating rogue-like progression, resource management, and deep customization. The player aims a ball, launches it, and destroys bricks on the screen.

*   **Aiming & Firing**: The player clicks and drags to aim a trajectory line, then releases to fire.
*   **Ball Health**: Balls have HP. Hitting walls reduces HP. If HP reaches zero, the ball is destroyed.
*   **Power-ups**: Most balls have active abilities triggered by clicking mid-flight.
*   **Combos**: Sequential brick hits without wall contact build a combo, granting end-of-turn rewards.

---

## Game Modes

1.  **Adventure Run**: Roguelike mode. Start from scratch, collect Coins (temp) and Gems (perm). Uses a standard set of balls.
2.  **Trial Run**: Skill mode. Uses *consumable* balls produced in the Home Base. No shop, no equipment drops. Collects Materials (Metal, Wire, Fuel).
3.  **Invasion Defend**: Tower Defense. Defend the Home Base layout from waves of NPC balls. Collects Enchanter items.
4.  **Home Base**: Persistent base-building. Generate resources (Food, Wood), craft balls, and manage the Ball Roster.

---

## Technical Architecture

### 1. Shop Upgrade System (New)

The shop uses an **Additive Argument System** for all ball-specific upgrades. 
*   **Final Stat Calculation**: `EffectiveStat = (EnchantedBaseStat) + (ShopLevel - 1) * ShopIncrement`.
*   **Dynamic UI**: The shop retrieves the "EnchantedBaseStat" live from the current ball instance, ensuring upgrades are always rewarding regardless of enchantment level.
*   **Stacking Buffs**: Certain balls (Piercing, Phaser, Grow, Chase) gain a `Bonus Damage on Power-up` buff. This is a stacking additive bonus applied to direct damage every time the ball's power-up is triggered. This stack resets when the ball is destroyed.

---

### 2. Core Systems

*   **`index.js`**: Entry point. Initializes the p5 instance and the `gameController`.
*   **`sketch.js`**: Contains the main game loop (`draw`), physics updates, and coordinates state transitions.
*   **`gameController.js`**: The API bridge. Allows UI modules to interact with the game state (e.g., `resetGame`, `upgradeBrick`) without direct dependency on p5 internals.
*   **`state.js`**: A singleton object holding all mutable game data.
    *   *Persistent*: XP, Gems, Home Base layout, Ball Inventory (`ballInventory`), Loadout (`currentLoadout`), Unlocks.
    *   *Transient*: Current run coins, active balls (`ballsInPlay`), combo count.
*   **`balancing.js`**: Configuration file for all static data (stats, costs, drop rates, unlock levels).

---

### 3. The Event System (`eventManager.js`)

To decouple complex interactions (especially Equipment effects), the game uses a Publish/Subscribe pattern.
*   **Publishers**: Core logic triggers events like `BallHitWall`, `BrickDestroyed`, `TurnStart`, `CoinCollected`.
*   **Subscribers**: `equipmentManager.js` listens to these events to apply passive effects (e.g., "Heal 10 HP when a brick is destroyed").
*   **Debug**: Events can be logged to the console via the Debug View.

---

### 4. Ball Roster System

Moved from "Global Ball Types" to "Individual Ball Instances".
*   **Inventory (`state.ballInventory`)**: An array of ball objects. Each has a unique `instanceId`, `type`, `level`, and specific `outcomes` (enchantment history).
*   **Loadout (`state.currentLoadout`)**: An array of 7 slots storing `instanceId` strings. These are the specific balls brought into an Adventure Run.
*   **Logic**: `ui/ballRoster.js` manages the UI for equipping/unequipping. `gameUtils.js` checks for level-based unlocks and auto-equips new balls.

---

### 5. Home Base & Economy

*   **Bricks as Buildings**: In Home Base mode, bricks function as buildings (`Farmland`, `Sawmill`, `BallProducer`).
*   **Logic**: `brickLogic.js`, `farmland.js`, and `sawmill.js` handle resource generation and interactions.
*   **Storage**: Resources (Food, Wood) have a cap determined by storage buildings.
*   **Production**: `BallProducer` bricks convert Food into specific Ball Instances stored in `EmptyCage` bricks for use in Trial Runs.

---

### 6. Rendering

*   **`render.js`**: Main rendering routine. Handles camera shake, drawing the board, and delegating entity drawing.
*   **`brickVisual.js`**: Procedural generation of brick visuals based on type and health threshold (e.g., gears for factories).
*   **`vfx.js`**: Particle systems, floating text, and other visual effects.

---

## Data Models

### Ball Instance
```javascript
{
  instanceId: "uuid",
  type: "classic", // 'explosive', 'sniper', etc.
  level: 1,        // Enchantment level
  outcomes: [],    // Array of string keys representing specific enchantments applied (e.g., 'A', 'B')
  costMultipliers: [], // Random factors affecting production cost
  stats: {},       // Computed stats cache
  isFavorite: false
}
```

### Brick
```javascript
{
  id: "uuid",
  c: 0, r: 0,      // Grid coordinates (-6 to 6)
  type: "normal",  // or 'goal', 'Farmland', etc.
  health: 10,
  maxHealth: 10,
  overlay: "spike", // String ID of active overlay
  overlayId: "uuid", // Reference to specific overlay item in inventory
  production: {},  // If producer: { queueCount, progress, type }
  inventory: []    // If cage: array of ball types
}
```

---

## Key Features

### Equipment
*   **Logic**: Handled by `equipmentManager.js`.
*   **Acquisition**: Found in runs or bought in the shop.
*   **Effect**: Modifies game rules via Event Listeners.

### Enchantment
*   **UI**: `ui/enchantment.js`.
*   **Mechanic**: Uses "Enchanter" items (loot) to increase success chance of leveling up a specific Ball Instance.
*   **Result**: Permanently buffs stats (HP, Damage, Special) of that specific ball.

### Editor
*   **Logic**: `levelEditor.js`.
*   **Modes**: 
    *   *Adventure*: Modify level layout for testing/fun.
    *   *Home Base*: "Pickup" and "Place" logic to rearrange base without losing building stats.

---

## Future Development Notes

*   **Migration**: Legacy saves use `state.ballEnchantments` (global stats per type). The `saveManager.js` contains migration logic to convert these into individual `ballInventory` instances upon load.
*   **Scaling**: `balancing.js` is the source of truth. Avoid hardcoding values in `sketch.js`.
*   **Performance**: `p5Instance` is globally accessible via `state.p5Instance` but should be used cautiously to avoid tight coupling in pure logic modules.
