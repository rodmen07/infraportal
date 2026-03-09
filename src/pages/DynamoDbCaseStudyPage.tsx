import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { CodeBlock } from '../features/consulting/CodeBlock'

const TECH_STACK = ['Rust', 'AWS SDK for Rust', 'DynamoDB', 'Tokio', 'CloudTrail', 'Splunk HEC', 'Bronze/Silver/Gold Pipeline']

const MEDALLION_LAYERS = [
  {
    layer: 'Bronze',
    description: 'Raw CloudTrail payloads are persisted unchanged for replayability and audit.',
  },
  {
    layer: 'Silver',
    description: 'Events are normalised, enriched, and validated into a stable analytical schema.',
  },
  {
    layer: 'Gold',
    description: 'Aggregated security and operations metrics are materialised for dashboards and alerting.',
  },
]

const HIGHLIGHTS: { label: string; detail: string; file: string; code: string; language?: string }[] = [
  {
    label: 'Idempotency lock',
    detail: 'A conditional PutItem with attribute_not_exists(pk) atomically acquires a per-event lock. If the item already exists DynamoDB rejects the write — only one Lambda processes each event even under parallel retries.',
    file: 'src/main.rs',
    code: `async fn try_acquire_idempotency(
    client: &Client,
    table_name: &str,
    event_id: &str,
    ttl_seconds: u64,
) -> Result<bool, aws_sdk_dynamodb::Error> {
    let now = epoch_seconds();
    let mut item = build_idempotency_key(event_id);
    item.insert("status".to_string(), AttributeValue::S("processing".to_string()));
    item.insert("created_at".to_string(), AttributeValue::N(now.to_string()));
    item.insert(
        "expires_at".to_string(),
        AttributeValue::N((now + ttl_seconds).to_string()),
    );

    let result = client
        .put_item()
        .table_name(table_name)
        .set_item(Some(item))
        .condition_expression("attribute_not_exists(pk)")  // ← atomic lock
        .send()
        .await;

    match result {
        Ok(_) => Ok(true),
        Err(SdkError::ServiceError(service_err))
            if service_err.err().is_conditional_check_failed_exception() => Ok(false),
        Err(err) => Err(err.into()),
    }
}`,
  },
  {
    label: 'Status lifecycle',
    detail: 'Records transition from "processing" → "done" or "failed", each stamped with a Unix timestamp. You can tell not just whether an event was processed, but when and whether it errored.',
    file: 'src/main.rs',
    code: `async fn mark_processed(
    client: &Client, table_name: &str, event_id: &str,
) -> Result<(), aws_sdk_dynamodb::Error> {
    let mut names = HashMap::new();
    names.insert("#status".to_string(), "status".to_string());
    let mut values = HashMap::new();
    values.insert(":status".to_string(), AttributeValue::S("done".to_string()));
    values.insert(":processed_at".to_string(), AttributeValue::N(epoch_seconds().to_string()));
    update_item(client, table_name, build_idempotency_key(event_id),
        "SET #status = :status, processed_at = :processed_at", names, values).await
}

async fn mark_failed(
    client: &Client, table_name: &str, event_id: &str, error_message: &str,
) -> Result<(), aws_sdk_dynamodb::Error> {
    let mut names = HashMap::new();
    names.insert("#status".to_string(), "status".to_string());
    names.insert("#error".to_string(), "error".to_string());
    let mut values = HashMap::new();
    values.insert(":status".to_string(), AttributeValue::S("failed".to_string()));
    values.insert(":error".to_string(), AttributeValue::S(error_message.to_string()));
    values.insert(":processed_at".to_string(), AttributeValue::N(epoch_seconds().to_string()));
    update_item(client, table_name, build_idempotency_key(event_id),
        "SET #status = :status, #error = :error, processed_at = :processed_at",
        names, values).await
}`,
  },
  {
    label: 'Duplicate counter',
    detail: 'Each suppressed retry atomically increments a duplicate_count attribute via an ADD expression — surfacing retry frequency without extra infrastructure.',
    file: 'src/main.rs',
    code: `async fn increment_duplicate_count(
    client: &Client,
    table_name: &str,
    event_id: &str,
) -> Result<(), aws_sdk_dynamodb::Error> {
    let mut values = HashMap::new();
    values.insert(":inc".to_string(), AttributeValue::N("1".to_string()));

    update_item(
        client,
        table_name,
        build_idempotency_key(event_id),
        "ADD duplicate_count :inc",   // ← atomic increment, initialises to 1 if absent
        HashMap::new(),
        values,
    )
    .await
}`,
  },
  {
    label: 'TTL-based expiry',
    detail: "expires_at is written as a Unix epoch on creation. DynamoDB's built-in TTL feature deletes records automatically when that epoch passes — no cron job, no Lambda, no cost.",
    file: 'src/main.rs',
    code: `fn epoch_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// Inside try_acquire_idempotency — TTL written at record creation:
let now = epoch_seconds();
item.insert("created_at".to_string(), AttributeValue::N(now.to_string()));
item.insert(
    "expires_at".to_string(),
    // DDB_TTL_SECONDS env var, default 86_400 (24 h).
    // Enable via DynamoDB TTL setting on the expires_at attribute.
    // DynamoDB auto-deletes the item when current time > expires_at.
    AttributeValue::N((now + ttl_seconds).to_string()),
);`,
  },
  {
    label: 'Fail-open design',
    detail: 'The Splunk HEC sender is a separate module — the idempotency layer wraps any downstream call. If delivery fails the record is marked "failed" rather than lost, and the Lambda can retry cleanly.',
    file: 'src/main.rs',
    code: `async fn process_cloudtrail_event(client: &Client) -> Result<(), aws_sdk_dynamodb::Error> {
    let table_name = std::env::var("DDB_TABLE").unwrap_or_else(|_| "example_table".to_string());
    let event_id  = std::env::var("EVENT_ID").unwrap_or_else(|_| "event-123".to_string());
    let ttl_secs  = std::env::var("DDB_TTL_SECONDS")
        .ok().and_then(|v| v.parse::<u64>().ok()).unwrap_or(86_400);

    let acquired = try_acquire_idempotency(client, &table_name, &event_id, ttl_secs).await?;
    if !acquired {
        increment_duplicate_count(client, &table_name, &event_id).await?;
        println!("Duplicate event skipped: {event_id}");
        return Ok(());
    }

    // send_to_splunk_hec is its own module — idempotency wraps any downstream call
    match send_to_splunk_hec(&event_id).await {
        Ok(()) => {
            mark_processed(client, &table_name, &event_id).await?;
            println!("Event processed: {event_id}");
        }
        Err(err) => {
            mark_failed(client, &table_name, &event_id, &err).await?;
            eprintln!("Failed to forward {event_id} to Splunk: {err}");
        }
    }
    Ok(())
}`,
  },
]

const FULL_SOURCE = `use aws_config::{meta::region::RegionProviderChain, BehaviorVersion};
use aws_sdk_dynamodb::{error::SdkError, types::AttributeValue, Client};
use std::collections::HashMap;
use std::error::Error;
use std::time::{SystemTime, UNIX_EPOCH};

async fn dynamodb_init() -> Client {
    let region_provider = RegionProviderChain::default_provider().or_else("us-east-1");
    let config = aws_config::defaults(BehaviorVersion::latest())
        .region(region_provider).load().await;
    Client::new(&config)
}

async fn create_item(client: &Client, table_name: &str, item: HashMap<String, AttributeValue>)
-> Result<(), aws_sdk_dynamodb::Error> {
    client.put_item().table_name(table_name).set_item(Some(item)).send().await?;
    Ok(())
}

async fn read_item(client: &Client, table_name: &str, key: HashMap<String, AttributeValue>)
-> Result<Option<HashMap<String, AttributeValue>>, aws_sdk_dynamodb::Error> {
    Ok(client.get_item().table_name(table_name).set_key(Some(key)).send().await?.item)
}

async fn update_item(
    client: &Client, table_name: &str, key: HashMap<String, AttributeValue>,
    update_expression: &str, expression_attribute_names: HashMap<String, String>,
    expression_attribute_values: HashMap<String, AttributeValue>,
) -> Result<(), aws_sdk_dynamodb::Error> {
    client.update_item()
        .table_name(table_name).set_key(Some(key))
        .update_expression(update_expression)
        .set_expression_attribute_names(Some(expression_attribute_names))
        .set_expression_attribute_values(Some(expression_attribute_values))
        .send().await?;
    Ok(())
}

async fn delete_item(client: &Client, table_name: &str, key: HashMap<String, AttributeValue>)
-> Result<(), aws_sdk_dynamodb::Error> {
    client.delete_item().table_name(table_name).set_key(Some(key)).send().await?;
    Ok(())
}

fn epoch_seconds() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn build_idempotency_key(event_id: &str) -> HashMap<String, AttributeValue> {
    let mut key = HashMap::new();
    key.insert("pk".to_string(), AttributeValue::S(event_id.to_string()));
    key.insert("sk".to_string(), AttributeValue::S("state".to_string()));
    key
}

async fn try_acquire_idempotency(
    client: &Client, table_name: &str, event_id: &str, ttl_seconds: u64,
) -> Result<bool, aws_sdk_dynamodb::Error> {
    let now = epoch_seconds();
    let mut item = build_idempotency_key(event_id);
    item.insert("status".to_string(), AttributeValue::S("processing".to_string()));
    item.insert("created_at".to_string(), AttributeValue::N(now.to_string()));
    item.insert("expires_at".to_string(), AttributeValue::N((now + ttl_seconds).to_string()));
    let result = client.put_item().table_name(table_name).set_item(Some(item))
        .condition_expression("attribute_not_exists(pk)").send().await;
    match result {
        Ok(_) => Ok(true),
        Err(SdkError::ServiceError(e)) if e.err().is_conditional_check_failed_exception() => Ok(false),
        Err(err) => Err(err.into()),
    }
}

async fn mark_processed(client: &Client, table_name: &str, event_id: &str)
-> Result<(), aws_sdk_dynamodb::Error> {
    let mut names = HashMap::new();
    names.insert("#status".to_string(), "status".to_string());
    let mut values = HashMap::new();
    values.insert(":status".to_string(), AttributeValue::S("done".to_string()));
    values.insert(":processed_at".to_string(), AttributeValue::N(epoch_seconds().to_string()));
    update_item(client, table_name, build_idempotency_key(event_id),
        "SET #status = :status, processed_at = :processed_at", names, values).await
}

async fn mark_failed(client: &Client, table_name: &str, event_id: &str, error_message: &str)
-> Result<(), aws_sdk_dynamodb::Error> {
    let mut names = HashMap::new();
    names.insert("#status".to_string(), "status".to_string());
    names.insert("#error".to_string(), "error".to_string());
    let mut values = HashMap::new();
    values.insert(":status".to_string(), AttributeValue::S("failed".to_string()));
    values.insert(":error".to_string(), AttributeValue::S(error_message.to_string()));
    values.insert(":processed_at".to_string(), AttributeValue::N(epoch_seconds().to_string()));
    update_item(client, table_name, build_idempotency_key(event_id),
        "SET #status = :status, #error = :error, processed_at = :processed_at", names, values).await
}

async fn increment_duplicate_count(client: &Client, table_name: &str, event_id: &str)
-> Result<(), aws_sdk_dynamodb::Error> {
    let mut values = HashMap::new();
    values.insert(":inc".to_string(), AttributeValue::N("1".to_string()));
    update_item(client, table_name, build_idempotency_key(event_id),
        "ADD duplicate_count :inc", HashMap::new(), values).await
}

async fn process_cloudtrail_event(client: &Client) -> Result<(), aws_sdk_dynamodb::Error> {
    let table_name = std::env::var("DDB_TABLE").unwrap_or_else(|_| "example_table".to_string());
    let event_id = std::env::var("EVENT_ID").unwrap_or_else(|_| "event-123".to_string());
    let ttl_seconds = std::env::var("DDB_TTL_SECONDS")
        .ok().and_then(|v| v.parse::<u64>().ok()).unwrap_or(86_400);
    let acquired = try_acquire_idempotency(client, &table_name, &event_id, ttl_seconds).await?;
    if !acquired {
        increment_duplicate_count(client, &table_name, &event_id).await?;
        let existing = read_item(client, &table_name, build_idempotency_key(&event_id)).await?;
        println!("Duplicate event skipped: {event_id} {existing:?}");
        return Ok(());
    }
    match send_to_splunk_hec(&event_id).await {
        Ok(()) => { mark_processed(client, &table_name, &event_id).await?; }
        Err(err) => { mark_failed(client, &table_name, &event_id, &err).await?; }
    }
    Ok(())
}

#[tokio::main]
async fn main() {
    let client = dynamodb_init().await;
    let run_demo = std::env::var("DEMO_CRUD")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true")).unwrap_or(false);
    let result = if run_demo {
        demo_crud_operations(&client).await
    } else {
        process_cloudtrail_event(&client).await
    };
    if let Err(error) = result { handle_error(&error); }
}`

export function DynamoDbCaseStudyPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [showSource, setShowSource] = useState(false)

  const toggle = (idx: number) => setOpenIdx(openIdx === idx ? null : idx)

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">DynamoDB Idempotency Prototype</h1>
            <p className="mt-1 text-sm text-amber-300/80">Rust · AWS SDK · CloudTrail · Splunk HEC</p>
          </div>
          <div className="flex gap-2">
            <a
              href="#/case-studies"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              ← Case studies
            </a>
            <a
              href="https://github.com/rodmen07/dynamodb_prototype"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:text-zinc-100"
            >
              GitHub →
            </a>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          A Rust prototype implementing exactly-once log delivery from AWS CloudTrail to a Splunk
          HEC endpoint. DynamoDB acts as a distributed idempotency store: a conditional write
          atomically acquires a per-event lock before any processing begins, preventing duplicate
          delivery even when the Lambda retries in parallel. The next evolution is a medallion
          architecture where this idempotent ingest path becomes the Bronze entrypoint for a
          Bronze/Silver/Gold data pipeline.
        </p>
      </section>

      <section className="forge-panel rounded-2xl border border-zinc-500/30 bg-zinc-900/80 p-5 backdrop-blur-xl">
        <h2 className="text-base font-semibold text-white">Medallion architecture extension</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          This keeps idempotency as the ingestion contract, then layers transformation and
          analytics outputs without coupling ingestion reliability to reporting concerns.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {MEDALLION_LAYERS.map((item) => (
            <div key={item.layer} className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-3">
              <h3 className="text-sm font-semibold text-amber-300">{item.layer}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <div className="flex flex-wrap gap-2">
        {TECH_STACK.map((tech) => (
          <span
            key={tech}
            className="rounded border border-zinc-700/50 bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-300"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Expandable highlights */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <div className="border-b border-zinc-700/40 px-5 py-4">
          <h2 className="text-base font-semibold text-white">How it works</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Click any item to see the implementation</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {HIGHLIGHTS.map(({ label, detail, file, code, language }, idx) => (
            <div key={label}>
              <button
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-zinc-800/30"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="shrink-0 text-amber-400">›</span>
                  <span className="font-medium text-zinc-200">{label}</span>
                </span>
                <span className="shrink-0 text-[10px] text-zinc-500">
                  {openIdx === idx ? '▲' : '▼'}
                </span>
              </button>
              <div className={`grid transition-all duration-200 ease-out ${openIdx === idx ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-3 px-5 pb-5 pt-1">
                    <p className="pl-4 text-sm leading-relaxed text-zinc-400">{detail}</p>
                    <CodeBlock code={code} language={language ?? 'rust'} file={file} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Full source toggle */}
      <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
        <button
          onClick={() => setShowSource(!showSource)}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-zinc-800/30"
        >
          <div>
            <span className="text-sm font-medium text-zinc-200">Full source</span>
            <span className="ml-2 text-xs text-zinc-500">src/main.rs</span>
          </div>
          <span className="text-[10px] text-zinc-500">{showSource ? '▲' : '▼'}</span>
        </button>
        <div className={`grid transition-all duration-200 ease-out ${showSource ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="border-t border-zinc-800/60 p-5">
              <CodeBlock code={FULL_SOURCE} language="rust" />
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
