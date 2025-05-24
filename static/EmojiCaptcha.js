const RESULT_CODE_ENUM = {
    SUCCESS: 'SUCCESS',
    WARNING: 'WARNING',
    BANNED: 'BANNED',
    VIPFAIL: 'VIPFAIL',
    TIMEOUT: 'TIMEOUT',
    VIP: 'VIP',
    DISABLED: 'DISABLED',
    UNKNOWN: 'UNKNOWN',
    MESSAGE: 'MESSAGE'
}

const $Template = (template, replacedObj) => {
    const element = $(template);

    const replace = (obj) => {
        Object.entries(obj).forEach(([key, target]) => {
            element.find(`template[js-template="${key}"]`).replaceWith(target || '');
        });
    }

    replace(replacedObj);

    return Object.assign(element, {$replace: replace});
};
const recoverOffsetValues = (e) => {
    var rect = e.target.getBoundingClientRect();
    var bodyRect = document.body.getBoundingClientRect();
    var x = e.originalEvent.changedTouches[0].pageX - (rect.left - bodyRect.left);
    var y = e.originalEvent.changedTouches[0].pageY - (rect.top - bodyRect.top);

    return {x, y};
};
const valueInRange = (min, max, value) => Math.max(min, Math.min(max, value));
class Timer {
    constructor(id, time, {onTick, onFinally, onAbort}) {
        this.time = time;
        this.value = time;
        this.onTick = onTick;
        this.onFinally = onFinally;
        this.onAbort = onAbort;

        this.setIntervalInstance = null;
        this.id = id;

        this.init();
    }

    init() {
        const callback = () => {
            this.value -= 1;
            if (this.value <= 0) {
                this.onFinally();
            } else {
                this.onTick(this.value);
            }
        }

        this.setIntervalInstance = setInterval(callback.bind(this), 1000);
    }
    destroy() {
        this.onAbort(this.value);
        clearInterval(this.setIntervalInstance);
    }
}
class TimerController {
    constructor() {
        this.timers = [];
    }
    useTimer(time) {
        const randomTimerId = Math.random();

        const create = ({onTick, onFinally, onAbort}) => {
            const timer = new Timer(randomTimerId, time, {onTick, onFinally, onAbort});
            this.timers.push(timer);
            return timer;
        }
        const abort = () => {
            this.timers.find(({id}) => id === randomTimerId)?.destroy();
        }
        const value = () => {
            return this.timers.find(({id}) => id === randomTimerId)?.value;
        }

        return ({value, create, abort})
    }
    clearAll() {
        this.timers.forEach((el) => {el.destroy()});
        this.timers = [];
    }
}

class EmojiCaptcha {
    constructor({createWarningFn}) {
        this.createWarningFn = createWarningFn;

        this.rootNode = null;
        this.timer = new TimerController();

        this.temp = null;

        this.initialRequestData = null; // { result: number, id: string, challenge: {...} }
        this.renderPayload = null; // { code: RESULT_CODE_ENUM, params: {...}}
        this.selectedEmojis = [];


        this.loading = false;
        this.hasHandlers = false;

        this._showHelp = false;

        this.init();
    }

    init() {
        this.rootNode = $('.captcha');
        $('input[name="captcha_type"]').attr('value', 'emoji_captcha');
        const container = $Template(`
            <div class="_captcha">
                <div style="display: none">
                    <input name="emoji_captcha_id" value=""/>
                    <span js-captcha-challange-data class="captcha-challange-data"></span> 
                </div>
                <div class="_captcha-content"></div>
            </div>
        `, {});
        $(document.head).append($(`
            <style>
                /* илюша жопич пидарок */
                .captcha {
                    position: relative;
                }
                ._captcha {
                    width: 100%;
                }
                ._captcha-container {
                    position: relative;
                    display: flex;  
                    gap: 10px;
                    flex-direction: column;
                    margin: 20px auto;
                    max-width: 320px;
                    margin: 24px auto;
                }
                ._captcha-content {
                    width: 100%;
                }
                ._captcha-wrapper {
                    position: relative;
                    display: flex;
                    height: min-content;
                    flex-direction: column;
                    gap: 6px;
                }
                ._captcha-image-container {
                    position: relative;
                    overflow: hidden;
                }
                ._captcha-help {
                    position: absolute;
                    top: 0;
                    right: 0;
                    display: grid;
                    grid-template-columns: 22px 1fr;
                    gap: 14px;
                    overflow: hidden;
                    height: 22px;
                    width: 22px;
                    border-radius: 20px 0 20px 20px;
                    background: transparent;
                    transition: all .1s linear;
                }
                ._captcha-help-open {
                    width: calc(100% + 37px);
                    height: 100%; 
                    border-radius: 0;
                    background: #ffffff;
                }
                ._captcha-help-icon {
                    cursor: pointer;
                    width: 20px;
                    height: 20px;
                    margin: 1px;
                    background: white;
                    color: black;
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                ._captcha-help-content {
                    position: relative;
                    padding: 6px;
                    display: flex;
                }
                ._captcha-help-text {
                    white-space: pre-line;
                    text-align: left;
                    font-size: 11px;
                    line-height: 12px;
                    color: black;
                }
                ._captcha-help-text > span:first-child {
                    font-weight: 600;
                }
                ._captcha-help-btn {
                    position: absolute;
                    right: 2px;
                    bottom: 2px;
                    border: none;
                    padding: 2px 13px !important;
                    font-size: 12px !important;
                }
                ._captcha-image {
                    user-select: none;
                    width: 100%;
                    z-index: 0;
                }
                ._captcha-keyboard {
                   display: flex;
                   gap: 5px;
                   flex-wrap: wrap;
                   justify-content: center;
                }
                ._captcha-keyboard-button {
                    transition: all .3s;
                    padding: 4px;
                    width: 60px;
                    height: 54px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    border: 1px solid var(--theme_default_btnborder);
                    background: white;
                }
                ._captcha-keyboard-button[disabled] {
                    background: #858585;
                }
                ._captcha-keyboard-button:not([disabled]):hover {
                    background: rgba(255,255,255,0.8);
                }
                ._captcha-keyboard-button:not([disabled]):focus {
                    background: rgba(255,255,255,0.8);
                }
                ._captcha-keyboard-icon {
                    width: 100%;
                    user-select: none;
                    user-drag: none;
                    -webkit-user-drag: none;
                    -moz-user-select: none;
                }
               
                ._captcha-keyboard-selected-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 3px;
                    border: 1px solid var(--theme_default_btnborder);
                    padding: 0px 10px;
                    border-radius: 6px;
                    align-items: center;
                    background: white;
                    min-height: 36px;
                }
                ._captcha-keyboard-selected-stub {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    text-align: center;
                    border: 0px solid var(--theme_default_btnborder);
                    padding: 0px;
                    border-radius: 6px;
                    min-height: 36px;
                    font-size: 17px;
                    gap: 4px;
                    user-select: none;
                }
                ._captcha-stub-title span[js-target-kaomoji] {
                    cursor: pointer;
                }
                ._captcha-stub-subtitle {
                    font-size: 12px;
                }
                ._captcha-keyboard-selected-item {
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                ._captcha-keyboard-selected-icon {
                    width: inherit;
                }
                .captcha__actions {
                    display: grid;
                    grid-template-columns: min-content 1fr;
                    gap: 10px;
                    justify-items: start;
                    padding: 0;
                    overflow: hidden;
                    min-height: 26px;
                    align-items: center;
                    border: 1px solid var(--theme_default_btnborder);
                    border-radius: 4px;
                    margin: 0;
                }
                .captcha__actions .captcha__actions-text {
                    width: 100%;
                    padding: 0 12px;
                    font-size: 14px;
                    text-align: center;
                }
                .captcha__actions .captcha__actions-btn {
                    padding: 0px 20px;
                    border: none !important;
                    border-right: 1px solid var(--theme_default_btnborder) !important;
                    color: var(--theme_default_text);
                    height: 100%;
                    border-radius: 0 !important;
                    white-space: nowrap;
                    font-size: 14px;
                }

                .captcha__timeouttext {
                    display: block;
                    position: relative !important;
                    left: auto !important;
                    top: auto !important;
                    right: auto !important;
                    transform: none !important;
                    width: 100%;
                    margin: 16px;
                    padding: 4px;
                    text-align: center;
                    font-size: 1.3em;
                    font-weight: 700;
                }
                .captcha__msg-success {
                    display: grid;
                    grid-template-columns: 1fr min-content;
                    gap: 10px;
                    justify-items: start;
                    padding: 0;
                    overflow: hidden;
                    min-height: 28px;
                    align-items: center;
                    border: 1px solid var(--theme_default_btnborder);
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .captcha__msg-success .captcha__msg-success-text {
                    width: 100%;
                    padding: 0 12px;
                    font-size: 16px;
                    text-align: center;
                }
                .captcha__msg-success .captcha__msg-success-btn {
                    padding: 0px 20px;
                    border: none !important;
                    border-left: 1px solid var(--theme_default_btnborder) !important;
                    color: var(--theme_default_text);
                    height: 100%;
                    border-radius: 0 !important;
                    white-space: nowrap;
                    font-size: 14px;
                }
                .captcha__msg-timeout {
                    display: grid;
                    grid-template-columns: 1fr min-content;
                    gap: 10px;
                    justify-items: start;
                    padding: 0;
                    overflow: hidden;
                    min-height: 28px;
                    align-items: center;
                    border: 1px solid var(--theme_default_btnborder);
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .captcha__msg-timeout .captcha__msg-timeout-text {
                    width: 100%;
                    padding: 0 12px;
                    font-size: 16px;
                    text-align: center;
                }
                .captcha__msg-timeout .captcha__msg-timeout-counter {
                    padding: 0px 10px;
                    border: none !important;
                    border-left: 1px solid var(--theme_default_btnborder) !important;
                    background: transparent;
                    color: var(--theme_default_text);
                    height: 100%;
                    border-radius: 0 !important;
                    white-space: nowrap;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                }
                .captcha__msg {
                    width: 100%;
                    min-height: 70px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 19px;
                    border-radius: 5px;
                    padding: 0 20px;
                    text-align: center;
                }
                .captcha__msg-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    max-width: 320px;
                    text-align: center;
                    margin: 20px auto;
                }
                .captcha__msg-error button {
                    max-width: 170px;
                    width: 100%;
                }
                .captcha__msg-simple {
                    margin: 2px 0 4px 0;
                    display: block;
                }
                .qr.qr_reply ._captcha-container {
                    max-width: none;
                    margin: 4px auto 4px auto;
                    padding: 0 5px;
                }
                .qr.qr_reply ._captcha-image-container {
                    max-width: 320px;
                    margin: 0 auto;
                    width: 100%;
                }
                .qr.qr_reply ._captcha-keyboard-button {
                    width: 50px;
                    height: 46px;
                }
                .qr.qr_reply ._captcha-keyboard-selected-list {
                    max-width: 300px;
                    width: 100%;
                    margin: 0 auto;
                }
            </style>
        `));
        this.rootNode.empty().append(container);
        this.captchaNode = $('.captcha ._captcha-content');
    }

    get showHelp() {
        return this._showHelp;
    }
    set showHelp(value) {
        this._showHelp = value;
        $('.captcha div[js-emoji-help]').toggleClass('_captcha-help-open', value);
        $('.captcha button[js-target-captcha-emoji]').attr('disabled', value);

        if (value) localStorage.setItem('emojiCaptchaHelpWasShown', true);
    }

    setCaptchaKey(key) {
        $('.captcha input[name="emoji_captcha_id"]').attr('value', key);
    }
    setChallengeData(data) {
        $('[js-captcha-challange-data]').text(JSON.stringify(data));
    }

    requestController(force) {
        switch (true) {
            case !this.initialRequestData:
                this.request();
                break;
            case force:
                this.request();
                break;
            default: this.renderFactory(this.initialRequestData.code, this.initialRequestData.params, false);
        }
    }
    async request() {
        if (this.loading) return;
        this.renderLoader();
        this.selectedEmojis = [];

        try {
            this.loading = true;
            this.initialRequestData = await (await fetch('/api/captcha/emoji/id')).json();
            const {result, id, challenge} = this.initialRequestData || {};

            if (result === 1 && !!id) {
                const response = await (await fetch(`/api/captcha/emoji/show?id=${id}`)).json();
                this.setCaptchaKey(id);
                this.setChallengeData(challenge);
                this.initialRequestData = {
                    ...this.initialRequestData,
                    image: response.image,
                    keyboard: response.keyboard,
                };
            }
            this.renderPayload = this.getRenderPayload(this.initialRequestData);
        } catch (error) {
            console.error(error);
            this.renderPayload = {code: RESULT_CODE_ENUM.UNKNOWN, params: {}};
        }

        this.loading = false;

        this.renderFactory(this.renderPayload.code, this.renderPayload.params);
    }
    getRenderPayload(requestData) {
        const {result, warning, banned, id, image, keyboard} = requestData;

        switch (true) {
            case !!warning:
                return ({code: RESULT_CODE_ENUM.WARNING, params: {message: warning}}); break;
            case !!banned:
                return ({code: RESULT_CODE_ENUM.BANNED, params: {message: banned}}); break;
            case result === -1:
                return ({code: RESULT_CODE_ENUM.TIMEOUT, params: {}}); break;
            case result === 0:
                return ({code: RESULT_CODE_ENUM.VIPFAIL, params: {}}); break;
            case result === 1:
                return ({code: RESULT_CODE_ENUM.SUCCESS, params: {id, image, keyboard}}); break;
            case result === 2:
                return ({code: RESULT_CODE_ENUM.VIP, params: {}}); break;
            case result === 3:
                return ({code: RESULT_CODE_ENUM.DISABLED, params: {}}); break;
            case result === 4:
                return ({code: RESULT_CODE_ENUM.TIMEOUT, params: {}}); break;

            default: return ({code: RESULT_CODE_ENUM.UNKNOWN, params: {}});
        }
    }
    renderFactory(resultCode, params, force = true) {
        switch (resultCode) {
            case RESULT_CODE_ENUM.TIMEOUT: this.renderTimeout(); break;
            case RESULT_CODE_ENUM.VIP: this.renderVIPSuccess(); break;
            case RESULT_CODE_ENUM.VIPFAIL: this.renderVIPFail(); break;
            case RESULT_CODE_ENUM.WARNING: this.createWarning?.('warning', params.message); break;
            case RESULT_CODE_ENUM.BANNED: this.createWarning?.('banned', params.message); break;
            case RESULT_CODE_ENUM.SUCCESS: this.renderCaptcha(params); break;
            case RESULT_CODE_ENUM.DISABLED: break;
            case RESULT_CODE_ENUM.UNKNOWN: this.renderError('Упс, капча сломалась.'); break;
            case RESULT_CODE_ENUM.MESSAGE: this.renderError(params.message); break;
        }
    }

    async renderCaptcha({id, image, keyboard}, isRerender) {
        const imageElement = $(`
            <div class="_captcha-image-container">
                <div class="_captcha-help" js-emoji-help>
                    <span class="_captcha-help-icon" js-emoji-help-btn-open>?</span>
                    <span class="_captcha-help-content">
                        <span class="_captcha-help-text"><span>Выберите все символы на картинке</span>
                            1. Порядок ввода иконок не важен
                            2. Не все иконки отображаются сразу
                            3. Отсутствующие иконки появятся в следующих шагах
                        </span>
                        <button type="button" class="button _captcha-help-btn" js-emoji-help-btn-close>Показать капчу</button>
                    </span>
                </div>
                <img js-target-image class="_captcha-image" src="data:image/png;base64, ${image}" />
            </div>
        `);
        const keyboardElement = $(`
            <div js-target-keyboard class="_captcha-keyboard">
                ${keyboard.map((el, i) => (`
                    <button class="_captcha-keyboard-button" type="button" js-target-captcha-emoji js-target-captcha-emoji-index="${i}">
                        <img class="_captcha-keyboard-icon" src="data:image/png;base64, ${el}"/>
                    </button>`
        )).join('')}
            </div>
        `);
        const selectedEmojisListElement = $(`
            <div js-target-keyboard-selected class="_captcha-keyboard-selected-list">
                ${this.selectedEmojis.map((el, i) => (`
                    <div class = "_captcha-keyboard-selected-item" type="button">
                        <img class="_captcha-keyboard-selected-icon" src="${el}"/>
                    </div>
                `)).join('')}
            </div>
        `);
        const selectedEmojisStubElement = $(`
            <div js-target-keyboard-selected class="_captcha-keyboard-selected-stub">
                <span class="_captcha-stub-title">EmojiCaptcha by Soplya <span js-target-kaomoji>(づ ◕‿◕ )づ</span></span>
            </div>
        `);

        const container = $Template(`
            <div class="_captcha-container">
                <div class="_captcha-wrapper" js-target-captcha>
                    <template js-template="selected"></template>
                    <template js-template="image"></template>
                    <template js-template="keyboard"></template>
                </div>
                <div class="captcha__actions">
                    <button class="button captcha__actions-btn" js-target-captcha-reset type="button">Обновить</button>
                    <span class="captcha__actions-text">Осталось: <span js-target-captcha-timeout></span> сек.</span>
                </div>
            </div>
        `, {});

        container.$replace({
            image: imageElement,
            keyboard: keyboardElement,
            selected: this.selectedEmojis.length ? selectedEmojisListElement : selectedEmojisStubElement,
        })

        this.captchaNode.empty().append(container);

        if (!isRerender) {
            this.initFirstHelpShow();
            this.initCaptchaTTLTimer();
        }
        await this.initHandlers();
    }

    renderLoader() {
        const content = $(`
            <span class="captcha__msg">Загрузка...</span>
        `);
        this.captchaNode.empty().append(content);
    }
    renderError(message) {
        const content = $(`
            <span class="captcha__msg-error">
                Ошибка сервера.
                <br/>
                ${message}
                <br/>
                <button class="button" js-target-captcha-reset type="button">Обновить</button>
            </span>
        `);

        this.initHandlers();

        this.captchaNode.empty().append(content);
    }
    renderVIPSuccess() {
        const content = $(`
            <span class="captcha__msg-simple">Вы - пасскодобоярин.</span>
        `);
        this.captchaNode.empty().append(content);
    }
    renderVIPFail() {
        const content = $(`
            <span class="captcha__msg-simple">Пасскод недействителен. Перелогиньтесь.</span>
        `);
        this.captchaNode.empty().append(content);
    }
    renderTimeout() {
        const content = $(`
            <div class="captcha__msg-timeout">
                <span class="captcha__msg-timeout-text">Таймаут капчи</span>
                <div class="captcha__msg-timeout-counter">
                    Осталось:&nbsp;<span js-captcha-timeout></span>&nbsp;секунд
                </div>
            </div>
        `);

        this.captchaNode.empty().append(content);
        this.initCaptchaTimeoutTimer();
    }
    renderSuccess() {
        const content = $(`
            <div class="captcha__msg-success">
                <span class="captcha__msg-success-text">Капча решена. Возможно.</span>
                <button type="button" class="button captcha__msg-success-btn" js-target-captcha-reset>
                    Повторить
                </button>
            </div>
        `);
        this.captchaNode.empty().append(content);
    }

    async initHandlers() {
        if (this.hasHandlers) return;
        this.hasHandlers = true;

        this.rootNode.on('click', this.onEmojiButtonClick.bind(this));
        this.rootNode.on('click', this.onResetButtonClick.bind(this));
        this.rootNode.on('click', this.onKaomojiClick.bind(this));
        this.rootNode.on('click', this.onHelpOpenBtnClick.bind(this));
        this.rootNode.on('click', this.onHelpCloseBtnClick.bind(this));
    }

    initCaptchaTTLTimer() {
        this.timer.clearAll();
        const {value, create, abort} = this.timer.useTimer(CFG.CAPTCHA_TTL || 300);

        const onTick = (value) => {
            this.TTL = value;
            $('span[js-target-captcha-timeout]').text(value);
        }
        const onFinally = () => {
            abort();
            this.request();
        }
        const onAbort = () => {}

        create({onFinally, onAbort, onTick});
        onTick(value());
    }
    initCaptchaTimeoutTimer() {
        this.timer.clearAll();
        const {value, create, abort} = this.timer.useTimer(CFG.CAPTCHARESET_TIMEOUT || 180);

        const onTick = (value) => {
            $('span[js-captcha-timeout]').text(value);
        }
        const onFinally = () => {
            abort();
            this.request();
        }
        const onAbort = () => {}

        create({onFinally, onAbort, onTick});
        onTick(value());
    }
    initCaptchaLoadingTimer(callback) {
        this.timer.clearAll();
        const {value, create, abort} = this.timer.useTimer(0);

        const onTick = (value) => {}
        const onFinally = () => {
            abort();
            callback();
        }
        const onAbort = () => {}

        create({onFinally, onAbort, onTick});
        onTick(value());
    }
    initFirstHelpShow() {
        const storageData = localStorage.getItem('emojiCaptchaHelpWasShown');
        try {
            if (!JSON.parse(storageData)) this.showHelp = true;
        } catch (e) {}
    }

    onResetButtonClick(event) {
        const target = $(event.target).closest('button[js-target-captcha-reset]');

        if (target.length) {
            this.timer.clearAll();
            this.request();
        }
    }
    onKaomojiClick(event) {
        const target = $(event.target).closest('span[js-target-kaomoji]');
        if (!target.length) return;

        this.kaomojiCounter = (this.kaomojiCounter || 0) + 1;

        if (this.kaomojiCounter >= 10){
            this.kaomojiCounter = 0;
            window.open('/static/media/doklikalsya.mp4');
        }
    }
    onHelpOpenBtnClick(event) {
        const target = $(event.target).closest('span[js-emoji-help-btn-open]');
        if (!target.length) return;
        this.showHelp = true;
    }
    onHelpCloseBtnClick(event) {
        const target = $(event.target).closest('button[js-emoji-help-btn-close]');
        if (!target.length) return;
        this.showHelp = false;
    }
    async onEmojiButtonClick(event) {
        const target = $(event.target).closest('button[js-target-captcha-emoji]');

        if (target.length && !this.busy) {
            this.busy = true;
            const emojiIndex = target.attr('js-target-captcha-emoji-index');
            const emojiImage = target.find('img').attr('src');

            try {
                const payload = {captchaTokenID: this.initialRequestData.id, emojiNumber: +emojiIndex}
                const response = await (await fetch('/api/captcha/emoji/click', {method: 'POST', body: JSON.stringify(payload)})).json();

                if (response.image && response.keyboard) {
                    this.selectedEmojis = [...this.selectedEmojis, emojiImage];
                    this.renderPayload = {
                        code: RESULT_CODE_ENUM.SUCCESS,
                        params: {
                            id: this.initialRequestData.id,
                            image: response.image,
                            keyboard: response.keyboard,
                        }
                    };

                    this.renderFactory(this.renderPayload.code, this.renderPayload.params, false);
                }
                if (response.success) {
                    this.setCaptchaKey(response.success);
                    this.timer.clearAll();
                    this.renderSuccess();
                }
            } catch (e) {
                this.timer.clearAll();
                this.renderPayload = {code: RESULT_CODE_ENUM.UNKNOWN, params: {}};
                this.renderFactory(this.renderPayload.code, this.renderPayload.params);
                console.log('error', e);
            }
            this.busy = false;
        }
    }

    async updateLimits() {
        let response = await fetch('/api/captcha/emoji/id');
        let data = null;
        if(response.ok) {
            data = await response.json();
            if(data['result'] != 2) return;
        } else {
            throw new Error('HTTP error');
        }
        CFG.BOARD.MAXFILESSIZE = FormFiles.max_files_size = data['maxFilesSize'];
        CFG.BOARD.MAXFILECOUNT = FormFiles.max = data['maxFiles'];
    }
}