import {createBackMainMenuButtons} from 'telegraf-inline-menu';

import {MyContext} from '../my-context.js';

export const backButtons = createBackMainMenuButtons<MyContext>(
	'back..','main..',
);
