"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
require('dotenv').config({ silent: true });
const pogobuf = require("pogobuf");
const Discord = require("discord.js");
const logger = require("winston");
const moment = require("moment");
const _ = require("lodash");
const Bluebird = require("bluebird");
let bot = new Discord.Client();
let client = null;
let lastLogin = moment();
let lastgmo = moment();
bot.on('ready', () => {
    logger.info('Discord bot ready.');
});
function PogoLogin() {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info('Login to pogo');
        let login = new pogobuf.PTCLogin();
        if (process.env.PROXY)
            login.setProxy(process.env.PROXY);
        let token = yield login.login(process.env.POGO_USER, process.env.POGO_PASSWORD);
        client = new pogobuf.Client({
            deviceId: process.env.DEVICE_ID,
            authType: 'ptc',
            authToken: token,
            version: 5702,
            useHashingServer: true,
            hashingKey: process.env.HASH_KEY,
            mapObjectsThrottling: false,
            includeRequestTypeInResponse: true,
            proxy: process.env.PROXY,
        });
        client.setPosition({
            latitude: parseFloat(process.env.LAT),
            longitude: parseFloat(process.env.LNG),
        });
        yield client.init(false);
        yield client.batchStart().batchCall();
        yield client.getPlayer('FR', 'fr', 'Europe/Paris');
        lastLogin = moment();
        logger.info('Logged in.');
    });
}
function CheckCoords(position, message) {
    return __awaiter(this, void 0, void 0, function* () {
        if (lastLogin.diff(moment(), 'minutes') >= 25)
            yield PogoLogin();
        client.setPosition(position);
        let waitABit = lastgmo.diff(moment(), 'seconds') - 10;
        if (waitABit > 0)
            yield Bluebird.delay(waitABit * _.random(1000, 1200));
        let cellIDs = pogobuf.Utils.getCellIDs(position.latitude, position.longitude);
        let response = yield client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0));
        let catchablePokemons = response.map_cells.reduce((all, c) => all.concat(c.catchable_pokemons), []);
        logger.info('%d pokemons to encounter', catchablePokemons.length);
        message.reply(`${catchablePokemons.length} pokemon(s) found, let me check them i detail.`);
        yield Bluebird.each(catchablePokemons, (pokemon) => __awaiter(this, void 0, void 0, function* () {
            logger.info('Encounter pokemon %d', pokemon.pokemon_id);
            yield Bluebird.delay(_.random(2500, 3500));
            let encounter = yield client.encounter(pokemon.encounter_id, pokemon.spawn_point_id);
            let pokemonData = encounter.wild_pokemon.pokemon_data;
            logger.debug('Encounter', pokemonData);
            let iv = (100 * (pokemonData.individual_attack + pokemonData.individual_defense + pokemonData.individual_stamina) / 45.0).toFixed(1);
            message.reply(`Pokemon with id=${pokemon.pokemon_id} and iv=${iv}`);
        }));
    });
}
bot.on('message', (message) => __awaiter(this, void 0, void 0, function* () {
    logger.info('[MESSAGE] %s', message);
    if (_.startsWith(message.content, '!check')) {
        let match = message.content.match(/(\d+(\.\d+)?),\s*(\d+(\.\d+)?)/);
        if (match) {
            let position = { latitude: parseFloat(match[1]), longitude: parseFloat(match[3]) };
            logger.info('Coords', position);
            message.reply(`sure I'll check right away at ${position.latitude},${position.longitude}`);
            yield CheckCoords(position, message);
        }
    }
}));
function Main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield PogoLogin();
        bot.login(process.env.DISCORD_TOKEN);
    });
}
Main()
    .catch(e => logger.error(e));
//# sourceMappingURL=index.js.map