import {Context as TelegrafContext} from 'telegraf';

export interface Session {
	page?: number;
}

export interface MyContext extends TelegrafContext {
	session: Session;
}
