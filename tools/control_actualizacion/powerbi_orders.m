let
    Source = PostgreSQL.Database("127.0.0.1:5433", "ecoroute", [CreateNavigationProperties=false, CommandTimeout=#duration(0,0,2,0)]),
    Facts = Source{[Schema="public", Item="analytics_order_facts"]}[Data],
    Columns = Table.SelectColumns(Facts, {"order_id", "tracking_number", "status", "route_id", "driver_id", "driver_name", "operation_date", "district", "scheduled", "delivered", "iid_valid", "digital_evidence", "ontime_evaluable", "on_time", "delayed", "complete_pod"})
in
    Columns
