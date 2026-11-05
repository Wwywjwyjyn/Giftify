/** تایپ‌های Marketapp API (طبق OpenAPI رسمی) */

export type Currency = 'GRAM' | 'TON' | 'USDT';

export type NFTAttribute = { trait_type: string; value: string | number };

export type NFTItem = {
  address: string;
  name: string;
  collection_address: string;
  owner?: string;
  real_owner?: string;
  min_bid?: string;
  max_bid?: string | null;
  currency?: Currency;
  attributes: NFTAttribute[];
  item_num?: number | null;
  listed_at?: number | null;
  is_restricted?: boolean | null;
};

export type RentItem = {
  nft_address: string;
  nft_name: string;
  owner: string;
  attributes: NFTAttribute[];
  min_duration: number;
  max_duration: number;
  price_per_day: string; // نانو TON
  discount_per_day: number;
  listed_at: number | null;
  is_sellable_during_rent?: boolean;
};

export type Collection = {
  name: string;
  address: string;
  extra_data?: {
    items?: number | null;
    floor?: string | null;
    rent_floor?: string | null;
    volume7d?: string | null;
    volume30d?: string | null;
    owners?: number | null;
    on_sale_all?: number | null;
    on_sale_onchain?: number | null;
  };
};

export type PriceResponse = { ton: number; gram: number; usd: number | null };

export type PremiumPrice = {
  months3: PriceResponse;
  months6: PriceResponse;
  months12: PriceResponse;
  boosts?: number;
};

export type SendTx = {
  validUntil: number;
  messages: { address: string; amount: string; payload?: string | null; stateInit?: string | null }[];
};

export type MAResult<T> = { ok: boolean; status: number; paid?: boolean; body: T | null; detail?: string };

export type ItemInfo = {
  address: string;
  collection_address: string;
  name: string;
  real_owner?: string | null;
  attributes: NFTAttribute[];
  status: 'for_sale' | 'on_auction' | 'for_rent' | 'rented' | 'for_sale_and_rent' | 'expired' | 'not_for_sale';
  status_details: unknown;
};
