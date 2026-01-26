import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const searchParamsParsers = {
  processName: parseAsString.withDefault(""),
  batchId: parseAsString.withDefault(""),
  accountId: parseAsString.withDefault(""),
  eventStatus: parseAsString.withDefault(""),
  startDate: parseAsString.withDefault(""),
  endDate: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
