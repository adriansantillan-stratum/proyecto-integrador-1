let
    Source = PostgreSQL.Database("127.0.0.1:5433", "ecoroute", [CreateNavigationProperties=false, CommandTimeout=#duration(0,0,2,0)]),
    Facts = Source{[Schema="public", Item="analytics_goal_facts"]}[Data]
in
    Facts
