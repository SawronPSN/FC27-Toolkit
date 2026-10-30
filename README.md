# Ron’s FC27 Toolkit

## What does it do?

- **Buying: Tired of inputting names and prices manually when buying players from a list?** Load the list into the tool and open webapp, the list helps you fill name, rating, buy prices with the click of one button.
- **Selling: Tired of typing sell prices when selling 200 fodders?** This tool lets you set the prices once and autofills for every card with one key press.
- **Unassigned: Wanna go Unassigned on the webapp?** Use the Glitch option to buy as many as you want.

> **Unofficial.** Not affiliated with EA or LevelledUp Gaming. The tool automates parts of EA’s web app, which may go against EA’s terms of service. Use it at your own risk.
>
> **You stay in control.** The tool never buys or sells on its own. It acts only when you press a key or click a button: it fills boxes, clicks the list button, and Swap moves duplicates. The 473 watcher only watches.

## Install

1. Install the **Tampermonkey** extension in your browser (Chrome/ Edge).
2. Open this link: <https://raw.githubusercontent.com/SawronPSN/FC27-Toolkit/main/fc27-toolkit.user.js>
3. Tampermonkey shows its install page.
4. Click **Install**.
5. Open the EA web app. The toolkit panel appears at the bottom left. For LevelledUp, open a page with list: a small **Scrape** box appears in the corner.

If the install page never appears, or the panel doesn’t show up on the EA web app, **this is the first thing to check**:

Newer versions of Chrome and Edge need **one extra switch** before Tampermonkey is allowed to run userscripts:

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Click **Details** on Tampermonkey.
3. Turn on **Allow User Scripts**. (Older browser versions need **Developer mode** switched on instead.)

Updates: Tampermonkey checks for new versions on its own. You can also open Tampermonkey → the script → **Check for updates**.

---

## User Guide

### The panel

Drag it with **☰**, minimize it with **–**. Its position and settings are remembered.

### Data tab: Input your lists

- **Excel List:** Use it if you want to input the list as an Excel file. Excel file should have only 3 columns: Column 1 = Player Name, Column 2 = Rating, Column 3 = Price. First row is not read, rather discarded as header. One file can have multiple sheets formatted similarly and can be chosen from.
- **LevelledUp Web:** **Only Useable** If you are subscribed to LevelledUp Gaming trading discord, you can use this tool to pick up the list directly from there. Just login as you normally would and open a page with list, the tool will pick it up and show a Scrape button. Then click it once and the list will be picked up. 
- **Sold:** Open **Transfer List**, click **Refresh**: It will pick the players from the *Sold Items* section.
- **Bid but Lost:** Open **Transfer Targets**, click **Refresh**: players from the *Expired Items* section.

Sold and Bid but Lost are matched against the list you used last (Excel List or LevelledUp Web), so they carry that list’s prices.

### Buy tab

Two modes, switched at the top.

**OP Mode**: The Player name, rating and buy prices are taken from the selected list and inputted in the webapp’s buy window with one press.

- Press **1** on keyboard fills the currently selected player into the **Player name box** and fills **Max Bid** with that player’s BIN price from the list.
- Press **2** = next player, Press **3** = previous player. The `« ▼ ▲ »` buttons jump by 10 / 1.

This mode should be used when you are buying following a clubstock list or OP list.

**Normal Mode**: You set the prices yourself in the four boxes:

- Press **1** on keyboard fills the boxes. If **all four** are empty it **clears** the boxes.
- **List / No list:** *List* also types the player’s name from the active list (Press 2 / 3 move through the list). *No list* leaves the name blank, so you pick the player yourself and only the prices are filled (only Press 1 is used).

### Sell tab

Use this when you are selling lots of players.

Set **Minimum Bid Price** and **Buy Now Price**.

Select a player (In Unassigned window or transfer list or an unsold item), then:

- **Press 1**: opens the *List on Transfer Market* / *Re-list Item* panel and fills the prices
- **Press 2**: clicks **List for Transfer**
- **Press 3**: only opens the *List on Transfer Market* / *Re-list Item* panel

### Glitch tab: Unassigned pile full (error 473)

The tool watches your bids and Buy Now purchases. When EA answers **Error 473** (Unassigned pile full), the tool turns **red**. Then follow the steps:

**Step 1:** Click **Clear cache**.

**Step 2:** Click **Swap**. It swaps 50 items from your unassigned list and then you can buy 50 more.

Use the **Stop** button to manually stop swapping whenever you want.

---

## Troubleshooting

- **No panel, or no install page:** turn on **Allow User Scripts** (see the top), make sure Tampermonkey and the script are enabled, then reload the EA page.
- **“Open Transfer Market > Search first”:** the Buy keys only work on the Search page.
- **“No match …”:** the name in your list didn’t match a search result. Check the spelling and the rating.
- **“Excel reader not loaded”:** refresh the page, or save the file as `.csv`.
- **LevelledUp Scrape box missing:** it only appears on pages that show the player table. If the site changes its layout the scraper can stop working: please open an issue.
- **Anything else:** include the status line at the bottom of the panel and your browser when you report it.

## Privacy

Everything stays in your browser. The script makes no network requests of its own; the only outside file it loads is the Excel reader (SheetJS) from jsDelivr.

## Feedback

Bugs and ideas: <https://github.com/SawronPSN/FC27-Toolkit/issues>
