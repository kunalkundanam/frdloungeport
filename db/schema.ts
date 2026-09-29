import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{
 code:text('code').primaryKey(),owner:text('owner').notNull(),state:text('state').notNull(),version:integer('version').notNull().default(0),expiresAt:integer('expires_at').notNull()
},t=>[index('rooms_owner_expiry').on(t.owner,t.expiresAt)]);
export const rateLimits=sqliteTable('rate_limits',{key:text('key').primaryKey(),window:integer('window').notNull(),count:integer('count').notNull()});
