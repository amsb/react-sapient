import React from "react";

let ENDPOINTS_COUNT = 0;
const ENDPOINT_BITS = {};
const CACHE = {};

function getChangedBits({ state: prev }, { state: next }) {
  let mask = 0;
  for (let id in next) {
    if (prev[id] !== next[id]) {
      mask |= ENDPOINT_BITS[id];
    }
  }
  return mask;
}

export const SapientContext = React.createContext({}, getChangedBits);

const PENDING = 0;
const RESOLVED = 1;
const REJECTED = 2;

export const Sapient = ({ children }) => {
  const [state, setState] = React.useState({});
  return (
    <SapientContext.Provider value={{ state, setState }}>
      {children}
    </SapientContext.Provider>
  );
};

function readCache(cache, fetch, id) {
  const result = cache[id];
  if (result === undefined) {
    const promise = fetch(id);
    cache[id] = { status: PENDING, value: promise };
    promise.then(
      value => {
        cache[id] = { status: RESOLVED, value: value };
      },
      error => {
        cache[id] = { status: REJECTED, value: error };
      }
    );
    throw promise;
  } else {
    const { status, value } = result;
    switch (status) {
      case PENDING: {
        throw value; // promise
      }
      case REJECTED: {
        throw value; // error
      }
      case RESOLVED: {
        return value; // cached value
      }
      default: {
        return null;
      }
    }
  }
}

function createEndpoint(name, methods, invalidates = []) {
  const endpointBits = (ENDPOINT_BITS[name] = 1 << ENDPOINTS_COUNT++);
  const endpointCache = (CACHE[name] = {});

  const invalidator = () => {
    const invalidatedValues = {};
    return [
      invalidatedValues,
      (name, id) => {
        invalidatedValues[name] = true;
        if (id === undefined) {
          CACHE[name] = {};
        } else {
          delete endpointCache[id];
        }
      }
    ];
  };

  function triggerUpdate(context, invalidatedValues) {
    context.setState(state => {
      const nextState = Object.assign({}, state);
      Object.keys(invalidatedValues).forEach(name => {
        nextState[name] = (state[name] || 0) + 1;
      });
      return nextState;
    });
  }

  const creator = context => data => {
    const [invalidatedValues, invalidate] = invalidator();
    methods.create(data, invalidate).then((newId, newData) => {
      const createdData = newData || data;
      endpointCache[newId] = { status: RESOLVED, value: createdData };
      triggerUpdate(context, invalidatedValues);
      return createdData;
    });
  };

  const updater = (context, id) => data => {
    const [invalidatedValues, invalidate] = invalidator();
    methods.update(id, data, invalidate).then(newData => {
      const updatedData = newData || data;
      invalidate(name, id);
      endpointCache[id] = { status: RESOLVED, value: updatedData };
      triggerUpdate(context, invalidatedValues);
      return updatedData;
    });
  };

  const deleter = (context, id) => () => {
    const [invalidatedValues, invalidate] = invalidator();
    methods.delete(id, invalidate).then(() => {
      invalidate(name, id);
      triggerUpdate(context, invalidatedValues);
    });
  };

  function accessEndpoint(context, id) {
    const value = readCache(endpointCache, methods.read, id);
    return [
      value,
      {
        ["create" + name]: creator(context),
        ["update" + name]: updater(context, id),
        ["delete" + name]: deleter(context, id)
      }
    ];
  }

  class UseEndpoint extends React.Component {
    render() {
      return (
        <SapientContext.Consumer unstable_observedBits={endpointBits}>
          {context =>
            this.props.children(...accessEndpoint(context, this.props.id))
          }
        </SapientContext.Consumer>
      );
    }
  }

  class UseCreateEndpoint extends React.Component {
    render() {
      return (
        <SapientContext.Consumer unstable_observedBits={endpointBits}>
          {context => this.props.children(creator(context))}
        </SapientContext.Consumer>
      );
    }
  }

  const endpoint = {
    ["Use" + name]: UseEndpoint,
    ["UseCreate" + name]: UseCreateEndpoint
  };

  if (React.useContext) {
    const useHook = id => {
      const context = React.useContext(SapientContext, endpointBits);
      return accessEndpoint(context, id);
    };

    const useCreateHook = () => {
      const context = React.useContext(SapientContext, endpointBits);
      return creator(context);
    };

    endpoint["use" + name] = useHook;
    endpoint["useCreate" + name] = useCreateHook;
  }

  return endpoint;
}

export function createApi(endpoints) {
  const api = {};
  for (let name in endpoints) {
    Object.assign(api, createEndpoint(name, endpoints[name]));
  }
  return api;
}
