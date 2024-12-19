/* eslint-disable no-unused-vars */
class c_config {
    constructor(args) {
        Object.keys(args).forEach((o) => {
            this[o] = args[o];
        });
    }
}

class timer {
    constructor() {
        this.offset = 0;
        this.clock = 0;
        this.interval = null;
        this.element = document.getElementById('timer');
        this.element_minutes = document.getElementById('timerMinutes');
        this.element_seconds = document.getElementById('timerSeconds');
        this.element_milliseconds =
            document.getElementById('timerMilliseconds');
    }

    delta() {
        let now = Date.now(),
            d = now - this.offset;

        this.offset = now;
        return d;
    }

    render() {
        let delta = this.clock,
            minutes = (delta / 60000) | 0,
            seconds = ((delta % 60000) / 1000) | 0,
            milliseconds = delta % 100;

        this.element_minutes.textContent = minutes.toString().padStart(1, '0');
        this.element_seconds.textContent = seconds.toString().padStart(2, '0');
        this.element_milliseconds.textContent = milliseconds
            .toString()
            .padStart(2, '0');
    }

    update() {
        this.clock += this.delta();
        this.render();
    }

    start() {
        //USE DATE
        this.offset = Date.now();
        this.interval = setInterval(this.update.bind(this), 47);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    reset() {
        this.clock = 0;
        this.render();
    }

    show() {
        this.element.classList.remove('hidden');
        this.element.classList.add('flex');
    }

    hide() {
        this.element.classList.remove('flex');
        this.element.classList.add('hidden');
    }
}
