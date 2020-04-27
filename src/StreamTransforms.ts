import { Writable } from "stream";

export function andFinally<X>(mapper: (input: X) => Promise<void>): Writable {
  return new Writable({
    objectMode: true,
    write: (data: X, _, done) => {
      mapper(data)
        .then((value) => {
          done();
        })
        .catch((error) => {
          done(error);
        });
    },
  });
}
