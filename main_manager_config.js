{
  "loopMs": 5000,
  "tail": true,
  "services": {
    "hack": {
      "enabled": false,
      "threads": 1,
      "args": [],
      "shareRam": true
    },
    "hacknet": {
      "enabled": false,
      "threads": 1,
      "args": []
    },
    "stocks": {
      "enabled": true,
      "threads": 1,
      "args": [],
      "useOwnedServers": true,
      "maxManipTargets": 2,
      "minCashReserveFraction": 0.05
    },
    "gang": {
      "enabled": false,
      "threads": 1,
      "args": []
    },
    "negativeKarma": {
      "enabled": false,
      "threads": 1,
      "args": [
        "main_manager_config.js"
      ]

    },
    "programs": {
      "enabled": true,
      "threads": 1,
      "args": []
    },
    "combatTrainer": {
      "enabled": false,
      "threads": 1,
      "args": ["main_manager_config.js", false, "Leadership"],
      "stats": {
        "strength": true,
        "defense": true,
        "dexterity": true,
        "agility": true,
        "charisma": false
      }
    },
    "playerStatsWorker": {
      "enabled": true,
      "threads": 1,
      "args": ["player_stats_data.txt", 10000, 360]
    },
    "playerStatsView": {
      "enabled": false,
      "threads": 1,
      "args": ["player_stats_data.txt"]
    },
    "overview": {
      "enabled": false,
      "threads": 1,
      "args": []
    },
    "serverAdmin": {
      "enabled": false,
      "threads": 1,
      "args": []
    },
    "root": {
      "enabled": true,
      "threads": 1,
      "args": []
    },
    "bladeburner": {
      "enabled": false,
      "threads": 1,
      "args": []
    },
    "ipvgo": {
      "enabled": false,
      "threads": 1,
      "args": ["Slum Snakes", 7]
    },
    "corporation": {
      "autoInvest": false,
      "autoGoPublic": false
    }
  },
  "gui": {
    "managerGui": {
      "autoBuy": true,
      "autoUpgrade": true,
      "upgradeRam": 1048576
    }
  }
}