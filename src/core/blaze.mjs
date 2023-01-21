import event from 'node:events';
import ws from 'ws';
import request from 'request-promise';
import { createHash, createHmac } from 'node:crypto';

/**
 * type opções da função start
 * 
 * @typedef {object} IOptionStart
 * @property {number} timeoutSendingAliveSocket
 */

/**
 * type response da função start
 * 
 * @typedef {object} IResponseStart
 * @property {event} ev
 * @property {(data: string) => void} sendToSocket
 * @property {() => void} closeSocket
 */

/**
 * @typedef {object} IDataBlazeResponse
 * @property {string} id
 * @property {string} created_at
 * @property {number} color
 * @property {number} roll
 * @property {string} server_seed
 */

/**
 * @typedef {object} IResponseRecents
 * @property {boolean} status
 * @property {any | null} error
 * @property {IDataBlazeResponse[]} response
 */

/**
 * ### Core que recebe resultados de jogos blaze
 * 
 * @class
 * @classdesc usando websocket, recebe de forma instantanea os resultados
 * @author Elizandro Dantas 
 * 
 * @see Blaze {@link https://blaze.com/pt/}
 * @see GitHub {@link https://github.com/elizandrodantas}
 */

export function BlazeCore(){
    this.temp = {
        isWaitingBefore: false,
        isGraphingBefore: false,
        isCompleteBefore: false
    }

    /**
     * @type {event}
     * @api private
     */

     this.ev = new event.EventEmitter();

     /**
      * @type {IResponseStart}
      * @api private
      */
 
     this.socket;

     /** @type {} */

     this.TILES = [
        { roll: 0, color: 0 },
        { roll: 11, color: 2 },
        { roll: 5, color: 1 },
        { roll: 10, color: 2 },
        { roll: 6, color: 1 },
        { roll: 9, color: 2 },
        { roll: 7, color: 1 },
        { roll: 8, color: 2 },
        { roll: 1, color: 1 },
        { roll: 14, color: 2 },
        { roll: 2, color: 1 },
        { roll: 13, color: 2 },
        { roll: 3, color: 1 },
        { roll: 12, color: 2 },
        { roll: 4, color: 1 }
    ]

    this.clientSeed = "0000000000000000002aeb06364afc13b3c4d52767e8c91db8cdb39d8f71e8dd";
}

/**
 * ### função que start e esculta todas atualizações do gammer selecionado junto a blazer
 * 
 * @method start
 * @memberof BlazeCore
 * @instance
 * @param {IOptionStart}
 * @returns {IResponseStart}
 * @api public
 */

BlazeCore.prototype.start = function(){
    let [ param0 ] = arguments;

    if(typeof param0 !== "object") param0 = {}

    let { 
        timeoutSendingAliveSocket,
     } = param0;

    let wss = new ws("wss://api-v2.blaze.com/replication/?EIO=3&transport=websocket", {
        origin: "https://blaze.com",
        headers: {
            'Upgrade': 'websocket',
            'Sec-Webscoket-Extensions': 'permessage-defalte; client_max_window_bits',
            'Pragma': 'no-cache',
            'Connection': 'Upgrade',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.6',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'
        }
    });

    let interval = setInterval(() => {
        wss.send('2');
    }, timeoutSendingAliveSocket || 5000);

    wss.on('open', () => {
        this.onOpen(wss, this.ev);
    });

    wss.on('message', (data) => {
        this.onMessage(data, this.ev);
    });

    wss.on('close', (code, reason) => {
        if(code !== 4999){
            setTimeout(() => {
                this.start();
            }, 2e3)
        }else{
            this.ev.emit('close', {
                code,
                reason: reason.toString()
            });
    
            clearInterval(interval);
            this.ev.removeAllListeners();
            wss.close();
        }
    });

    this.socket = {
        ev: this.ev,
        closeSocket: () => {
            clearInterval(interval);
            wss.close(4999);
        },
        sendToSocket: (data) => {
            wss.send(data, () => {});
        } 
    };
}

/**
 * ### responsavel de obter os jogos mais recentes
 * 
 * @method recents
 * @memberof BlazeCore
 * @interface
 * @returns {Promise<IResponseRecents>}
 * @api public
 */

BlazeCore.prototype.recents = async function(){
    try{
        let data = await request.get("https://blaze.com/api/roulette_games/recent", { json: true });

        return { status: true, error: null, response: data }
    }catch(err){
        return { status: false, error: err.message }
    }
}

/**
 * ### gera jogadas recents com o server seed
 * 
 * @method recents
 * @memberof BlazeCore
 * @interface
 * @param {string} server_seed 
 * @param {length} [length=40] 
 * @return {{color: number, roll: number}[]}
 * @api public
 */

BlazeCore.prototype.generateRecents = function(server_seed, length = 40){
    const chain = [server_seed],
        output = [];

    for(let i = 0; i < length; i++){
        chain.push(
            createHash('sha256')
                .update(chain[chain.length - 1])
                .digest("hex")
        );
    }

    for(let i of chain){
        const hash = createHmac('sha256', i)
            .update(this.clientSeed)
            .digest("hex");

        const roll = parseInt(hash, 16) % 15;
    
        output.push(
            this.TILES.find(e => e.roll === roll)
        )
    }

    return output;
}

/**
 * ### Envia interesse para o servidor
 * 
 * @method onOpen
 * @memberof BlazeCore
 * @private
 * @instance 
 * @param {ws} wss 
 * @param {event} ev 
 * @returns {void}
 * @api private
 */

BlazeCore.prototype.onOpen = function(wss, ev){
    wss.send('423["cmd",{"id":"subscribe","payload":{"room":"double"}}]')
    wss.send('423["cmd",{"id":"subscribe","payload":{"room":"double_v2"}}]')

    ev.emit('authenticated', {
        success: true
    });
}

/**
 * ### analiza e atualiza o status do gamer
 * 
 * @method onMessage
 * @memberof BlazeCore
 * @private
 * @instance
 * @param {any} data 
 * @param {EventEmitter} ev 
 * @returns {void} 
 * @api private
*/

BlazeCore.prototype.onMessage = function(data, ev){
    let msg = data.toString(), id;

    try {
        id = this._getString(msg, '"id":"', '"', 0)
    } catch (err) {
        id = ''
    }

    if (id == "double.tick" || id == 'doubles.update') {
        let obj = msg.slice(2, msg.length),
            { payload: json } = JSON.parse(obj)[1],
            type = id.includes('update') ? 'v1' : 'v2',
            game = id.includes('crash') ? 'crash' : 'doubles';

        ev.emit(id, {
            type,
            ...json
        });

        if (json.status == 'graphing' || json.status == "rolling") {
            if (!this.temp.isGraphingBefore){
                ev.emit('game_graphing', {
                    type,
                    game,
                    isRepeated: this.temp.isGraphingBefore,
                    ...json
                });
                this._updateTemp('graphing');
            }
        } else if (json.status == 'waiting') {
            if (!this.temp.isWaitingBefore){
                ev.emit('game_waiting', {
                    type,
                    game,
                    isRepeated: this.temp.isWaitingBefore,
                    ...json
                });
                this._updateTemp('waiting');
            }
        } else {
            if (!this.temp.isCompleteBefore){
                ev.emit('game_complete', {
                    type,
                    game,
                    isRepeated: this.temp.isCompleteBefore,
                    ...json
                });
                this._updateTemp('complete');
            }
        }
    }
}

/**
 * ### busca por partes especificas na string
 * 
 * * ```javascript
 *  BlazeCore.getString('hello word', 'e', 'r', 0);
 *  // "llo wo"
 * ```
 * @method _getString
 * @private
 * @memberof BlazeCore
 * @interface
 * @param {string} string 
 * @param {string} start 
 * @param {string} end 
 * @param {number} i 
 * @returns {string} 
 * @api private
 * 
*/

BlazeCore.prototype._getString = function(string, start, end, i){
   i++;
   var str = string.split(start);
   var str = str[i].split(end);
   return str[0];
}

/**
 * ### altera o status do gamer
 * 
 * @method _updateTemp
 * @private
 * @memberof BlazeCore
 * @interface
 * @param {"graphing" | "waiting" | "complete"} update
 * @returns {void}
 * @api private
 */

BlazeCore.prototype._updateTemp = function(update){
    if (update == 'waiting') {
        this.temp.isWaitingBefore = true;
        this.temp.isGraphingBefore = false;
        this.temp.isCompleteBefore = false;
    } else if (update == 'graphing') {
        this.temp.isGraphingBefore = true;
        this.temp.isWaitingBefore = false;
        this.temp.isCompleteBefore = false;
    } else if (update == 'complete') {
        this.temp.isCompleteBefore = true;
        this.temp.isWaitingBefore = false;
        this.temp.isGraphingBefore = false;
    }
}