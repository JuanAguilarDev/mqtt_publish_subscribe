const iotsdk = require("aws-iot-device-sdk-v2");
const { exit } = require("process");
const mqtt = iotsdk.mqtt; 
const TextDecoder = require("util").TextDecoder;
const yargs = require("yargs");
const common_args = require("./util/cli_args");

yargs
  .command(
    "*",
    false,
    (yargs) => {
      common_args.add_direct_connection_establishment_arguments(yargs);
      common_args.add_topic_message_arguments(yargs);
    },
    main
  )
  .parse();

async function execute_session(connection, argv) {
  return new Promise(async (resolve, reject) => {
    try {
      let published = false;
      let subscribed = false;

      const decoder = new TextDecoder("utf8");
      const on_publish = async (topic, payload) => {
        const json = decoder.decode(payload);
        const message = JSON.parse(json);
        console.log(message) //mensaje en objeto de entrada
        date = message.ts.replace("T", " ").slice(0, 19);
        voltaje1 = message.d[0].value;
        voltaje2 = message.d[1].value;
        voltaje3 = message.d[2].value;
        amperaje1 = message.d[3].value;
        amperaje2 = message.d[4].value;
        amperaje3 = message.d[5].value;
        kilowatt = message.d[6].value;
        dataPool = `19520|SD|DL:0.0.0:AT.0.0.0|${date}|0|0|0|${voltaje1}|${voltaje2}|${voltaje3}|${amperaje1}|${amperaje2}|${amperaje3}|0|0|0|0|0|0|0|0|0|0|0|0|0|0|${kilowatt}|0|0`;

        //HOST
        const host = "52.91.193.20";
        const net = require("net");
        //configuracion del puerto
        const port = 2000;
        //crear cliente
        const client1 = new net.Socket();
        //Conexion al puerto y host especificado
        client1.connect(port, host,function () {
          //Log conexion establecido
          console.log(`Client 1 :Connected to server on port ${port}`);
          client1.write(dataPool);
        });
        //respuesta del server
        client1.on("data", function (data) {
          console.log(`Client 1 received from server : ${data}`);
        });
        // cierre de socket
        client1.on("close", function () {
          console.log("Client 1 :Connection Closed");
        });
        client1.on("error", function (error) {
          console.error(`Connection Error ${error}`);
        });

        if (message.sequence == argv.count) {
          subscribed = true;
          if (subscribed && published) {
            resolve();
          }
        }
      };

      await connection.subscribe(argv.topic, mqtt.QoS.AtLeastOnce, on_publish);
      let published_counts = 0;
      for (let op_idx = 0; op_idx < argv.count; ++op_idx) {
        const publish = async () => {
          const msg = {
            message: argv.message,
            sequence: op_idx + 1,
          };
          const json = JSON.stringify(msg);
          connection
            .publish(argv.topic, json, mqtt.QoS.AtLeastOnce)
            .then(() => {
              ++published_counts;
              if (published_counts == argv.count) {
                published = true;
                if (subscribed && published) {
                  resolve();
                }
              }
            });
        };
        setTimeout(publish, op_idx * 5000);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function main(argv) {
  common_args.apply_sample_arguments(argv);

  const connection = common_args.build_connection_from_cli_args(argv);

  // force node to wait 90 seconds before killing itself, promises do not keep node alive
  // ToDo: we can get rid of this but it requires a refactor of the native connection binding that includes
  //    pinning the libuv event loop while the connection is active or potentially active.
  const timer = setInterval(() => {}, 90 * 1000);

  await connection.connect().catch((error) => {
    console.log("Connect error: " + error);
    exit(-1);
  });
  await execute_session(connection, argv).catch((error) => {
    console.log("Session error: " + error);
    exit(-1);
  });
  await connection.disconnect().catch((error) => {
    console.log("Disconnect error: " + error), exit(-1);
  });

  // Allow node to die if the promise above resolved
  clearTimeout(timer);
}
