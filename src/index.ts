require('dotenv').config({silent: true});

import * as pogobuf from 'pogobuf';
import * as Discord  from 'discord.js';
import * as logger from 'winston';
import * as moment from 'moment';
import * as _ from 'lodash';
import * as Bluebird from 'bluebird';

let bot = new Discord.Client();
let client: pogobuf.Client = null;
let lastLogin = moment();
let lastgmo = moment();

bot.on('ready', () => {
    logger.info('Discord bot ready.');
});

async function PogoLogin() {
    logger.info('Login to pogo');

    let login = new pogobuf.PTCLogin();
    if (process.env.PROXY) login.setProxy(process.env.PROXY);

    let token = await login.login(process.env.POGO_USER, process.env.POGO_PASSWORD);

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

    await client.init(false);
    await client.batchStart().batchCall();
    await client.getPlayer('FR', 'fr', 'Europe/Paris');

    lastLogin = moment();
    logger.info('Logged in.');
}

async function CheckCoords(position, message: Discord.Message) {
    if (lastLogin.diff(moment(), 'minutes') >= 25) await PogoLogin();

    client.setPosition(position);
    let waitABit = lastgmo.diff(moment(), 'seconds') - 10;
    if (waitABit > 0) await Bluebird.delay(waitABit * _.random(1000, 1200));

    let cellIDs = pogobuf.Utils.getCellIDs(position.latitude, position.longitude);
    let response = await client.getMapObjects(cellIDs, Array(cellIDs.length).fill(0));
    let catchablePokemons = response.map_cells.reduce((all, c) => all.concat(c.catchable_pokemons), []);
    logger.info('%d pokemons to encounter', catchablePokemons.length);
    message.reply(`${catchablePokemons.length} pokemon(s) found, let me check them i detail.`);

    await Bluebird.each(catchablePokemons, async pokemon => {
        logger.info('Encounter pokemon %d', pokemon.pokemon_id);
        await Bluebird.delay(_.random(2500, 3500));

        let encounter = await client.encounter(pokemon.encounter_id, pokemon.spawn_point_id);
        let pokemonData = encounter.wild_pokemon.pokemon_data;
        logger.debug('Encounter', pokemonData);
        let iv = (100 * (pokemonData.individual_attack + pokemonData.individual_defense + pokemonData.individual_stamina) / 45.0).toFixed(1);
        message.reply(`Pokemon with id=${pokemon.pokemon_id} and iv=${iv}`);
    });
}

bot.on('message', async message => {
    logger.info('[MESSAGE] %s', message);
    if (_.startsWith(message.content, '!check')) {
        let match = message.content.match(/(\d+(\.\d+)?),\s*(\d+(\.\d+)?)/);
        if (match) {
            let position = { latitude: parseFloat(match[1]), longitude: parseFloat(match[3]) };
            logger.info('Coords', position);

            message.reply(`sure I'll check right away at ${position.latitude},${position.longitude}`);

            await CheckCoords(position, message);
        }
    }
});


async function Main() {
    await PogoLogin();
    bot.login(process.env.DISCORD_TOKEN);
}

Main()
.catch(e => logger.error(e));