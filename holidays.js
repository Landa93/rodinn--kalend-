/* ==========================================
   RODINNÝ KALENDÁŘ – ČESKÉ SVÁTKY
   ========================================== */

(function () {
    "use strict";

    const fixedHolidays = {
        "01-01": "Nový rok / Den obnovy samostatného českého státu",
        "05-01": "Svátek práce",
        "05-08": "Den vítězství",
        "07-05": "Den slovanských věrozvěstů Cyrila a Metoděje",
        "07-06": "Den upálení mistra Jana Husa",
        "09-28": "Den české státnosti",
        "10-28": "Den vzniku samostatného československého státu",
        "11-17": "Den boje za svobodu a demokracii",
        "12-24": "Štědrý den",
        "12-25": "1. svátek vánoční",
        "12-26": "2. svátek vánoční"
    };

    function pad(number) {
        return String(number).padStart(2, "0");
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    // Výpočet Velikonoční neděle pro daný rok.
    function getEasterSunday(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k + 7) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);

        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;

        return new Date(year, month - 1, day);
    }

    function getHoliday(date) {
        const key = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

        if (fixedHolidays[key]) {
            return fixedHolidays[key];
        }

        const easter = getEasterSunday(date.getFullYear());

        const goodFriday = new Date(easter);
        goodFriday.setDate(goodFriday.getDate() - 2);

        const easterMonday = new Date(easter);
        easterMonday.setDate(easterMonday.getDate() + 1);

        if (dateKey(date) === dateKey(goodFriday)) {
            return "Velký pátek";
        }

        if (dateKey(date) === dateKey(easterMonday)) {
            return "Velikonoční pondělí";
        }

        return "";
    }

    // Jmeniny budeme doplňovat samostatně.
    // Zatím vrací prázdný text, aby aplikace
    // správně fungovala i bez seznamu jmenin.
    function getNameDay() {
        return "";
    }

    window.CzechCalendar = {
        getHoliday,
        getNameDay
    };
})();
