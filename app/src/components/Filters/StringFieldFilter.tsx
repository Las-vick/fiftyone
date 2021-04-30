import React from "react";
import {
  atomFamily,
  DefaultValue,
  GetRecoilValue,
  selectorFamily,
  SetRecoilState,
} from "recoil";
import { animated } from "react-spring";

import * as selectors from "../../recoil/selectors";
import StringFilter from "./StringFilter";
import { AGGS } from "../../utils/labels";
import { useExpand, hasNoneField } from "./utils";
import socket from "../../shared/connection";
import { packageMessage } from "../../utils/socket";
import { number } from "prop-types";

type StringFilter = {
  values: string[];
  exclude: boolean;
  _CLS: string;
};

type Value = string | null;

const getFilter = (get: GetRecoilValue, path: string): StringFilter => {
  return {
    ...{
      values: [],
      exclude: false,
    },
    ...get(selectors.filterStage(path)),
  };
};

const meetsDefault = (filter: StringFilter) =>
  filter.values.length === 0 && filter.exclude === false;

const setFilter = (
  get: GetRecoilValue,
  set: SetRecoilState,
  path: string,
  key: string,
  value: boolean | string[] | DefaultValue
) => {
  const filter = {
    ...getFilter(get, path),
    [key]: value,
    _CLS: "str",
  };
  if (filter.values.length === 0) {
    filter.exclude = false;
  }
  if (meetsDefault(filter)) {
    set(selectors.filterStage(path), null);
  } else {
    set(selectors.filterStage(path), filter);
  }
};

export const selectedValuesAtom = selectorFamily<Value[], string>({
  key: "filterStringFieldValues",
  get: (path) => ({ get }) => getFilter(get, path).values,
  set: (path) => ({ get, set }, value) =>
    setFilter(get, set, path, "values", value),
});

export const selectedValuesModalAtom = atomFamily<Value[], string>({
  key: "modalFilterStringFieldValues",
  default: [],
});

export const excludeAtom = selectorFamily<boolean, string>({
  key: "filterStringFieldExclude",
  get: (path) => ({ get }) => getFilter(get, path).exclude,
  set: (path) => ({ get, set }, value) =>
    setFilter(get, set, path, "exclude", value),
});

export const excludeModalAtom = atomFamily<boolean, string>({
  key: "modalFilterStringFieldExclude",
  default: false,
});

export const searchStringField = atomFamily<string, string>({
  key: "searchStringField",
  default: "",
});

export const stringFieldValues = selectorFamily<
  { count: number; results: string[] },
  string
>({
  key: "searchStringFields",
  get: (path) => async ({ get }) => {
    const search = get(searchStringField(path));

    const wrap = (handler, type) => ({ data }) => {
      data = JSON.parse(data);
      data.type === type && handler(data);
    };

    const promise = new Promise<{ count: number; results: string[] }>(
      (resolve) => {
        const listener = wrap(({ count, results }) => {
          socket.removeEventListener("message", listener);
          resolve({ count, results });
        }, "distinct");
        socket.addEventListener("message", listener);
        socket.send(packageMessage("all_tags", { path, search }));
      }
    );

    const result = await promise;
    return result;
  },
});

export const valuesAtom = selectorFamily<
  { total: number; count: number; results: string[] },
  string
>({
  key: "stringFieldValues",
  get: (path) => ({ get }) => {
    let total = (get(selectors.datasetStats) ?? []).reduce((acc, cur) => {
      if (cur.name === path && cur._CLS === AGGS.DISTINCT_COUNT) {
        return cur.result;
      }
      return acc;
    }, []);
    return {
      total,
      ...get(stringFieldValues(path)),
    };
  },
});

export const fieldIsFiltered = selectorFamily<
  boolean,
  { path: string; modal?: boolean }
>({
  key: "stringFieldIsFiltered",
  get: ({ path, modal }) => ({ get }) => {
    const values = modal ? selectedValuesModalAtom : selectedValuesAtom;
    const exclude = modal ? excludeModalAtom : excludeAtom;
    return get(values(path)).length > 0 || exclude(path);
  },
});

const StringFieldFilter = ({ expanded, entry }) => {
  const [ref, props] = useExpand(expanded);

  return (
    <animated.div style={props}>
      <StringFilter
        name={"Values"}
        valueName={"value"}
        color={entry.color}
        valuesAtom={valuesAtom(entry.path)}
        selectedValuesAtom={selectedValuesAtom(entry.path)}
        excludeAtom={excludeAtom(entry.path)}
        ref={ref}
      />
    </animated.div>
  );
};

export default React.memo(StringFieldFilter);
