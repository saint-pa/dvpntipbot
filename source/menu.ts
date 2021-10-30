import {MenuTemplate} from 'telegraf-inline-menu';

import {MyContext} from './my-context.js';


export const menu = new MenuTemplate<MyContext>('welcome to dvpntipbot');

menu.url('Telegram API Documentation', 'https://core.telegram.org/bots/api');
menu.url('Telegraf Documentation', 'https://telegraf.js.org/');
menu.url('Inline Menu Documentation', 'https://github.com/EdJoPaTo/telegraf-inline-menu');